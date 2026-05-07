"""
Notification sender — runs every 5 minutes via GitHub Actions.

Finds all alerts where:
  - notify_at is in the past (or within the next 5 minutes)
  - sent_at is NULL

For each, verifies the court is bookable for that date via the LTA API,
then sends a Resend email with the direct booking link.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import requests
import resend
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
RESEND_API_KEY = os.environ["RESEND_API_KEY"]
FROM_EMAIL = os.environ.get("FROM_EMAIL", "alerts@yourdomain.com")
LTA_AVAIL = "https://www.lta.org.uk/api/courtdetail/availability"

resend.api_key = RESEND_API_KEY


def booking_url(court: dict, date_str: str) -> str:
    if court.get("clubspark_slug"):
        return (
            f"https://clubspark.lta.org.uk/{court['clubspark_slug']}"
            f"/Booking/BookByDate#?date={date_str}"
        )
    return (
        f"https://www.lta.org.uk/play/book-a-tennis-court/courts/"
        f"{court['name'].lower().replace(' ', '-')}_{court['venue_uuid']}/"
    )


def is_date_bookable(venue_uuid: str, date_str: str) -> bool:
    try:
        r = requests.get(
            LTA_AVAIL,
            params={"venueid": venue_uuid, "date": date_str},
            timeout=8,
        )
        if r.status_code != 200:
            return False
        data = r.json()
        available = data.get("rules", {}).get("availableDates", [])
        return date_str in available
    except Exception:
        return False


def send_email(alert: dict, court: dict) -> None:
    date_str     = alert["desired_date"]
    time_str     = alert["desired_time_start"][:5]
    court_name   = court["name"]
    book_url     = booking_url(court, date_str)

    date_display = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A %-d %B")
    drop_time    = court.get("drop_time", "now")[:5] if court.get("drop_time") else "now"

    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #16a34a; margin-bottom: 4px;">🎾 Court booking opening soon</h2>
      <p style="color: #374151; font-size: 16px; margin-top: 8px;">
        <strong>{court_name}</strong> bookings for <strong>{date_display}</strong>
        open at <strong>{drop_time}</strong> — that's in about 5 minutes.
      </p>
      <p style="color: #374151;">
        You wanted to play at <strong>{time_str}</strong>. Be ready to grab your slot.
      </p>
      <a href="{book_url}"
         style="display:inline-block; margin-top:16px; padding: 12px 24px;
                background:#16a34a; color:#fff; text-decoration:none;
                border-radius:6px; font-weight:600; font-size:16px;">
        Book now →
      </a>
      <p style="color:#9ca3af; font-size:12px; margin-top:24px;">
        You signed up for this alert on LondonTennisCourts.
        The booking window opens at {drop_time} — open the link just before then
        and refresh at the drop time.
      </p>
    </div>
    """

    resend.Emails.send({
        "from":    FROM_EMAIL,
        "to":      [alert["email"]],
        "subject": f"🎾 {court_name} booking opens in 5 min — {date_display}",
        "html":    html,
    })
    print(f"  Email sent to {alert['email']} for {court_name} on {date_str}")


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    now    = datetime.now(timezone.utc)
    window = (now + timedelta(minutes=5)).isoformat()

    # Fetch alerts due within the next 5 minutes that haven't been sent
    alerts = (
        sb.table("alerts")
        .select("*, courts(*)")
        .lte("notify_at", window)
        .is_("sent_at", "null")
        .not_.is_("notify_at", "null")
        .execute()
        .data
    )

    print(f"Found {len(alerts)} alerts due at {now.isoformat()}")

    for alert in alerts:
        court = alert["courts"]
        date_str = alert["desired_date"]

        print(f"\nProcessing alert {alert['id']} — {court['name']} on {date_str}")

        if not is_date_bookable(court["venue_uuid"], date_str):
            print(f"  Date {date_str} not yet bookable — skipping (will retry next run)")
            continue

        try:
            send_email(alert, court)
            sb.table("alerts").update(
                {"sent_at": now.isoformat()}
            ).eq("id", alert["id"]).execute()
        except Exception as e:
            print(f"  Failed to send email: {e}")


if __name__ == "__main__":
    main()
