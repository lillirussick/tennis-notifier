"""
Learning phase script — runs every 15 minutes via GitHub Actions for the
first week. For each court in the DB, fetches the LTA availability API and
records the first time each future date appears as bookable.

After ~7 observations per court, we have enough data to calculate a reliable
drop time. That drop time is then written back to the courts table and all
pending alerts for that court get their notify_at scheduled.

GitHub Actions runs this on: */15 * * * *
"""

from __future__ import annotations

import os
import statistics
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
LTA_AVAIL    = "https://www.lta.org.uk/api/courtdetail/availability"

# How many observations before we consider a drop time "learned"
MIN_OBSERVATIONS = 5
# Minutes before the learned drop time to send the notification email
NOTIFY_LEAD_MINUTES = 5


def fetch_available_dates(venue_uuid: str) -> list[str]:
    """Returns list of date strings (YYYY-MM-DD) currently bookable for this venue."""
    # We query 14 days out to capture any newly opened dates
    target = (datetime.now(timezone.utc) + timedelta(days=14)).strftime("%Y-%m-%d")
    try:
        r = requests.get(
            LTA_AVAIL,
            params={"venueid": venue_uuid, "date": target},
            timeout=10,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        return data.get("rules", {}).get("availableDates", [])
    except Exception as e:
        print(f"  Error fetching {venue_uuid}: {e}")
        return []


def record_new_dates(sb, court: dict, available_dates: list[str]) -> list[str]:
    """
    For any date in available_dates not yet in drop_observations, insert a row.
    Returns the list of newly recorded dates.
    """
    now = datetime.now(timezone.utc).isoformat()
    court_id = court["id"]
    new_dates = []

    for date_str in available_dates:
        try:
            sb.table("drop_observations").insert(
                {
                    "court_id":      court_id,
                    "observed_date": date_str,
                    "first_seen_at": now,
                }
            ).execute()
            new_dates.append(date_str)
            print(f"  New date observed: {date_str} for {court['name']}")
        except Exception:
            # Unique constraint violation = already recorded, skip
            pass

    return new_dates


def maybe_learn_drop_time(sb, court: dict) -> None:
    """
    If we have enough observations, calculate the drop time and update the court.
    Then schedule notify_at for any pending alerts on that court.
    """
    if court.get("drop_time_confidence") == "confirmed":
        return

    rows = (
        sb.table("drop_observations")
        .select("observed_date, first_seen_at")
        .eq("court_id", court["id"])
        .order("first_seen_at")
        .execute()
        .data
    )

    if len(rows) < MIN_OBSERVATIONS:
        return

    # For each observation, derive: how many days before the observed_date did it appear?
    # and what time of day?
    day_offsets = []
    times_of_day = []  # minutes since midnight

    for row in rows:
        obs_date   = datetime.strptime(row["observed_date"], "%Y-%m-%d").date()
        first_seen = datetime.fromisoformat(row["first_seen_at"]).astimezone(timezone.utc)
        seen_date  = first_seen.date()

        day_offset = (obs_date - seen_date).days
        if day_offset < 0:
            continue
        day_offsets.append(day_offset)

        # time in minutes from midnight (UTC — courts are in London so this is UTC+0/+1)
        minutes = first_seen.hour * 60 + first_seen.minute
        times_of_day.append(minutes)

    if not day_offsets:
        return

    median_offset = round(statistics.median(day_offsets))
    median_minutes = round(statistics.median(times_of_day))

    # The observed time is the LATEST it could have dropped (we saw it within 15 min of drop)
    # Subtract polling interval to get a conservative estimate
    drop_minutes = max(0, median_minutes - 15)
    drop_hh = drop_minutes // 60
    drop_mm = drop_minutes % 60
    drop_time_str = f"{drop_hh:02d}:{drop_mm:02d}:00"

    print(f"  Learned drop time for {court['name']}: offset={median_offset}d time={drop_time_str}")

    sb.table("courts").update(
        {
            "drop_day_offset":      median_offset,
            "drop_time":            drop_time_str,
            "drop_time_confidence": "learned",
        }
    ).eq("id", court["id"]).execute()

    schedule_pending_alerts(sb, court["id"], median_offset, drop_minutes)


def schedule_pending_alerts(sb, court_id: str, day_offset: int, drop_minutes: int) -> None:
    """For all unsent alerts on this court with no notify_at, calculate and set notify_at."""
    alerts = (
        sb.table("alerts")
        .select("id, desired_date")
        .eq("court_id", court_id)
        .is_("notify_at", "null")
        .is_("sent_at", "null")
        .execute()
        .data
    )

    for alert in alerts:
        desired_date = datetime.strptime(alert["desired_date"], "%Y-%m-%d").date()
        drop_date    = desired_date - timedelta(days=day_offset)
        notify_dt    = datetime(
            drop_date.year, drop_date.month, drop_date.day,
            (drop_minutes - NOTIFY_LEAD_MINUTES) // 60,
            (drop_minutes - NOTIFY_LEAD_MINUTES) % 60,
            tzinfo=timezone.utc,
        )
        sb.table("alerts").update(
            {"notify_at": notify_dt.isoformat()}
        ).eq("id", alert["id"]).execute()
        print(f"  Scheduled alert {alert['id']} → notify at {notify_dt.isoformat()}")


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    courts = sb.table("courts").select("*").execute().data
    print(f"Checking {len(courts)} courts at {datetime.now(timezone.utc).isoformat()}")

    for court in courts:
        print(f"\n{court['name']} ({court['venue_uuid']})")
        available_dates = fetch_available_dates(court["venue_uuid"])
        if not available_dates:
            print("  No dates returned")
            continue

        record_new_dates(sb, court, available_dates)
        maybe_learn_drop_time(sb, court)


if __name__ == "__main__":
    main()
