"""
Fast coordinate enrichment: re-runs the LTA grid sweep and assigns each
court the lat/lng of the grid point that found it. Accurate to ~2 miles,
which is good enough for distance filtering.

Courts already enriched (lat IS NOT NULL) are skipped.

Run once:
  python scraper/enrich_coords.py
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
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

COURT_URL_RE = re.compile(
    r'/play/book-a-tennis-court/courts/([a-z0-9][a-z0-9\-]*?)_'
    r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
)

LAT_RANGE = [round(51.28 + i * 0.06, 2) for i in range(8)]
LNG_RANGE = [round(-0.52 + i * 0.07, 2) for i in range(12)]


def scrape_courts_near(lat: float, lng: float) -> list[tuple[str, str]]:
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
        print(f"  Error at {lat},{lng}: {e}")
        return []


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Load all courts that still need coordinates
    rows = sb.table("courts").select("id, venue_uuid, lat").execute().data
    needs_coords = {r["venue_uuid"]: r["id"] for r in rows if not r["lat"]}
    print(f"{len(needs_coords)} courts need coordinates. Running grid sweep...\n")

    enriched = 0

    for lat in LAT_RANGE:
        for lng in LNG_RANGE:
            results = scrape_courts_near(lat, lng)
            for slug, uuid in results:
                if uuid in needs_coords:
                    sb.table("courts").update(
                        {"lat": lat, "lng": lng}
                    ).eq("id", needs_coords[uuid]).execute()
                    del needs_coords[uuid]
                    enriched += 1
                    print(f"  {slug}: ({lat}, {lng})")
            time.sleep(0.3)

    print(f"\nDone. Enriched {enriched} courts.")
    if needs_coords:
        print(f"{len(needs_coords)} courts still without coordinates (outside grid).")


if __name__ == "__main__":
    main()
