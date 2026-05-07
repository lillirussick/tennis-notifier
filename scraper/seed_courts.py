"""
One-time script: discovers all London Clubspark courts by scraping the
LTA court search results page across a grid of London coordinates.

The LTA renders court cards server-side into the HTML. Each card contains
a URL with the pattern:
  /play/book-a-tennis-court/courts/{name-slug}_{uuid}/

We sweep a grid of lat/lng points covering Greater London, parse every
court URL from the HTML, and upsert into Supabase.

Run once:
  python scraper/seed_courts.py
"""

from __future__ import annotations

import os
import re
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

LTA_SEARCH = "https://www.lta.org.uk/play/book-a-tennis-court/"
LTA_AVAIL  = "https://www.lta.org.uk/api/courtdetail/availability"
GEOCODE_IO = "https://api.postcodes.io/postcodes/{postcode}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

# Regex extracts (slug, uuid) from court card URLs
COURT_URL_RE = re.compile(
    r'/play/book-a-tennis-court/courts/([a-z0-9][a-z0-9\-]*?)_'
    r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
)

# Grid covering Greater London: lat 51.28–51.70, lng -0.52–0.32
# Points spaced ~0.06° (~4 miles) apart
LAT_RANGE = [round(51.28 + i * 0.06, 2) for i in range(8)]   # 51.28 → 51.70
LNG_RANGE = [round(-0.52 + i * 0.07, 2) for i in range(12)]  # -0.52 → 0.30


def slug_to_name(slug: str) -> str:
    return slug.replace("-", " ").title()


def geocode_postcode(postcode: str):
    try:
        r = requests.get(
            GEOCODE_IO.format(postcode=postcode.replace(" ", "")),
            timeout=5,
        )
        data = r.json().get("result", {})
        return data.get("latitude"), data.get("longitude")
    except Exception:
        return None, None


def get_court_postcode(venue_uuid: str) -> tuple[str, float, float]:
    """Fetch the LTA court detail page to extract postcode and coords."""
    try:
        r = requests.get(
            LTA_AVAIL,
            params={"venueid": venue_uuid, "date": "2026-05-14"},
            timeout=8,
            headers=HEADERS,
        )
        # The availability endpoint doesn't give postcode, but confirms
        # the court exists. Postcode comes from the detail page.
        return "", None, None
    except Exception:
        return "", None, None


def scrape_courts_near(lat: float, lng: float) -> list[tuple[str, str]]:
    """
    Fetch LTA search results for a lat/lng point.
    Returns list of (slug, uuid) tuples found in the HTML.
    """
    try:
        r = requests.get(
            LTA_SEARCH,
            params={"latitude": lat, "longitude": lng},
            headers=HEADERS,
            timeout=15,
        )
        if r.status_code != 200:
            return []
        return COURT_URL_RE.findall(r.text)
    except Exception as e:
        print(f"  Error fetching {lat},{lng}: {e}")
        return []


def upsert_court(sb, slug: str, uuid: str) -> bool:
    name = slug_to_name(slug)
    try:
        sb.table("courts").upsert(
            {"venue_uuid": uuid, "name": name, "clubspark_slug": slug},
            on_conflict="venue_uuid",
        ).execute()
        return True
    except Exception as e:
        print(f"  DB error for {name}: {e}")
        return False


def enrich_with_coordinates(sb):
    """
    For courts without lat/lng, try to get their postcode from the LTA
    court detail page and geocode it.
    """
    courts = (
        sb.table("courts")
        .select("id, name, venue_uuid, postcode, lat")
        .is_("lat", "null")
        .execute()
        .data
    )
    print(f"\nEnriching {len(courts)} courts with coordinates...")
    for court in courts:
        # Fetch the LTA court detail page HTML to extract postcode
        try:
            detail_url = (
                f"https://www.lta.org.uk/play/book-a-tennis-court/courts/"
                f"{court['name'].lower().replace(' ', '-')}_{court['venue_uuid']}/"
            )
            r = requests.get(detail_url, headers=HEADERS, timeout=10)
            pc_match = re.search(
                r'[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}', r.text
            )
            if pc_match:
                postcode = pc_match.group(0)
                lat, lng = geocode_postcode(postcode)
                if lat and lng:
                    sb.table("courts").update(
                        {"postcode": postcode, "lat": lat, "lng": lng}
                    ).eq("id", court["id"]).execute()
                    print(f"  {court['name']}: {postcode} ({lat}, {lng})")
            time.sleep(0.5)
        except Exception as e:
            print(f"  Failed to enrich {court['name']}: {e}")


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    seen: set[str] = set()
    total_new = 0

    print(f"Sweeping {len(LAT_RANGE) * len(LNG_RANGE)} grid points across London...\n")

    for lat in LAT_RANGE:
        for lng in LNG_RANGE:
            results = scrape_courts_near(lat, lng)
            new_here = 0
            for slug, uuid in results:
                if uuid not in seen:
                    seen.add(uuid)
                    if upsert_court(sb, slug, uuid):
                        total_new += 1
                        new_here += 1
            if results:
                print(f"  {lat},{lng:+.2f} → {len(results)} courts found, {new_here} new")
            time.sleep(0.5)  # be polite

    print(f"\nGrid sweep done. {total_new} new courts added.")
    print(f"Total unique courts seen: {len(seen)}")

    enrich_with_coordinates(sb)
    print("\nAll done.")


if __name__ == "__main__":
    main()
