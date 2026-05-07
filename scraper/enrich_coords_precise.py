"""
Bulk-update court coordinates using two passes:
  1. postcodes.io  — fast batch geocoding, accurate to ~100m in London
  2. Nominatim     — OpenStreetMap lookup by court name, best for park courts
                     (rate-limited to 1 req/s; skipped if postcode pass sufficed)

Run from the scraper/ directory:
  python enrich_coords_precise.py            # postcode pass only (fast, ~15s)
  python enrich_coords_precise.py --nominatim # both passes (slower, ~10 min)
"""
from __future__ import annotations

import os
import sys
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

# ---------------------------------------------------------------------------
# Pass 1: postcodes.io bulk geocoding
# ---------------------------------------------------------------------------

def bulk_geocode_postcodes(postcodes: list[str]) -> dict[str, tuple[float, float]]:
    """Geocode up to 100 postcodes per request using the bulk endpoint."""
    coords: dict[str, tuple[float, float]] = {}
    for i in range(0, len(postcodes), 100):
        batch = [p.strip().upper() for p in postcodes[i : i + 100] if p.strip()]
        try:
            r = requests.post(
                "https://api.postcodes.io/postcodes",
                json={"postcodes": batch},
                timeout=15,
            )
            if r.ok:
                for item in r.json().get("result") or []:
                    if item and item.get("result"):
                        coords[item["query"].upper()] = (
                            item["result"]["latitude"],
                            item["result"]["longitude"],
                        )
        except Exception as e:
            print(f"  postcodes.io batch error: {e}")
        time.sleep(0.2)
    return coords


# ---------------------------------------------------------------------------
# Pass 2: Nominatim (OpenStreetMap) — one request per court
# ---------------------------------------------------------------------------

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "tennis-notifier/1.0 (github.com/lillirussick/tennis-notifier)"


def nominatim_lookup(name: str, postcode: str) -> tuple[float, float] | None:
    """Try to find exact coordinates by court name via OpenStreetMap."""
    queries = [
        f"{name} {postcode} London",
        f"{name} London",
    ]
    for q in queries:
        try:
            r = requests.get(
                NOMINATIM,
                params={"q": q, "format": "json", "limit": 1, "countrycodes": "gb"},
                headers={"User-Agent": UA},
                timeout=10,
            )
            if r.ok:
                hits = r.json()
                if hits:
                    return float(hits[0]["lat"]), float(hits[0]["lon"])
        except Exception:
            pass
        time.sleep(1.1)  # Nominatim policy: max 1 req/s
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    use_nominatim = "--nominatim" in sys.argv

    # Fetch all courts
    rows = (supabase.from_("courts").select("id, name, postcode, lat, lng").execute().data or [])
    total = len(rows)
    print(f"Found {total} courts.\n")

    # --- Pass 1: postcodes.io ---
    print("Pass 1: bulk postcode geocoding...")
    unique_postcodes = list({(r.get("postcode") or "").strip().upper() for r in rows if r.get("postcode")})
    pc_coords = bulk_geocode_postcodes(unique_postcodes)
    print(f"  Geocoded {len(pc_coords)}/{len(unique_postcodes)} postcodes.\n")

    updated_pc = 0
    needs_nominatim: list[dict] = []

    for court in rows:
        postcode = (court.get("postcode") or "").strip().upper()
        coords = pc_coords.get(postcode)
        if coords:
            lat, lng = coords
            supabase.from_("courts").update({"lat": lat, "lng": lng}).eq("id", court["id"]).execute()
            print(f"  ✓ postcode  {court['name'][:50]:<50}  {lat:.5f}, {lng:.5f}")
            updated_pc += 1
            if use_nominatim:
                needs_nominatim.append(court)
        else:
            print(f"  ✗ no postcode  {court['name']}")
            if use_nominatim:
                needs_nominatim.append(court)

    print(f"\nPass 1 done: {updated_pc}/{total} updated via postcode.\n")

    # --- Pass 2: Nominatim refinement (optional) ---
    if not use_nominatim:
        print("Tip: run with --nominatim for a second pass using OpenStreetMap")
        print("     (slower ~10 min but more accurate for park courts)")
        return

    print(f"Pass 2: Nominatim refinement for {len(needs_nominatim)} courts...")
    updated_nom = 0
    for i, court in enumerate(needs_nominatim, 1):
        name = court["name"]
        postcode = (court.get("postcode") or "").strip()
        coords = nominatim_lookup(name, postcode)
        if coords:
            lat, lng = coords
            supabase.from_("courts").update({"lat": lat, "lng": lng}).eq("id", court["id"]).execute()
            print(f"  [{i}/{len(needs_nominatim)}] ✓ nominatim  {name[:45]:<45}  {lat:.5f}, {lng:.5f}")
            updated_nom += 1
        else:
            print(f"  [{i}/{len(needs_nominatim)}] ~ no match   {name}")

    print(f"\nPass 2 done: {updated_nom}/{len(needs_nominatim)} refined via Nominatim.")
    print(f"\nTotal: {updated_pc} postcode + {updated_nom} Nominatim updates.")


if __name__ == "__main__":
    main()
