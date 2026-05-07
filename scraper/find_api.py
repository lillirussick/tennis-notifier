"""
Runs a headless browser, searches the LTA court finder, and prints every
API call made — so we can identify the court search endpoint.

Run once:
  pip install playwright
  playwright install chromium
  python scraper/find_api.py
"""

import asyncio
import json
from playwright.async_api import async_playwright

SEARCH_URL = "https://www.lta.org.uk/play/book-a-tennis-court/"
POSTCODE = "N5 2AL"


SKIP_DOMAINS = [
    "google", "crazyegg", "evergage", "hotjar", "visualstudio",
    "analytics", "pagead", "doubleclick", "facebook", "trafficguard",
    "webtrends", "bing", "twitter", "linkedin",
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        async def handle_request(request):
            url = request.url
            if any(x in url for x in SKIP_DOMAINS):
                return
            if "lta.org.uk" in url or "clubspark" in url:
                print(f"\n→ REQUEST {request.method} {url}")
                try:
                    body = request.post_data
                    if body:
                        print(f"  BODY: {body[:300]}")
                except Exception:
                    pass

        async def handle_response(response):
            url = response.url
            if any(x in url for x in SKIP_DOMAINS):
                return
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    body = await response.json()
                    print(f"\n✅ JSON from: {url}")
                    print(json.dumps(body, indent=2)[:800])
            except Exception:
                pass

        page.on("request", handle_request)
        page.on("response", handle_response)

        # Court results are server-rendered into the HTML
        RESULTS_URL = (
            "https://www.lta.org.uk/play/book-a-tennis-court/"
            "?latitude=51.5640&longitude=-0.1034&location=N5+2AL&date=#"
        )
        print(f"Navigating to search results URL...")
        await page.goto(RESULTS_URL, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Dump the full page HTML so we can find court data
        html = await page.content()

        # Look for UUIDs (pattern: 8-4-4-4-12 hex chars)
        import re
        uuids = re.findall(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            html
        )
        print(f"\nFound {len(uuids)} UUIDs in page HTML:")
        for u in set(uuids):
            print(f"  {u}")

        # Look for court/venue names near those UUIDs
        print("\n--- Snippets containing UUIDs ---")
        for u in set(uuids):
            idx = html.find(u)
            if idx >= 0:
                snippet = html[max(0, idx-200):idx+200]
                print(f"\n{u}:\n{snippet}\n")

        # Also save full HTML for manual inspection
        with open("scraper/page_output.html", "w") as f:
            f.write(html)
        print("\nFull HTML saved to scraper/page_output.html")

        print("\nDone.")
        await browser.close()


asyncio.run(main())
