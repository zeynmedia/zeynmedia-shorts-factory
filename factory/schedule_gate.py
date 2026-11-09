"""Hourly cron gate: picks 3-4 random upload hours per day (seeded by date) and
says whether a video is due now. Catches up if a scheduled run was skipped."""
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

TR = timezone(timedelta(hours=3))
ROOT = Path(__file__).resolve().parent.parent
FIRST_HOUR, LAST_HOUR, MIN_GAP = 9, 22, 3


def todays_hours(day):
    line = os.environ.get("HISTORY_FILE") or ""  # a second production line gets its own hours
    rng = random.Random(f"{day.isoformat()}-{os.environ.get('GITHUB_REPOSITORY', '')}{line}")
    n = rng.choice([3, 4])  # 2026-11 analytics: views track upload count, a Short fades after ~3 days
    while True:
        hours = sorted(rng.sample(range(FIRST_HOUR, LAST_HOUR + 1), n))
        if all(b - a >= MIN_GAP for a, b in zip(hours, hours[1:])):
            return hours


def uploads_on(day):
    try:
        history = json.loads((ROOT / (os.environ.get("HISTORY_FILE") or "data/history.json")).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return 0
    count = 0
    for h in history:
        # Scheduled runs count even without an upload (a line with no channel yet only publishes Releases)
        if not (h.get("video_id") or h.get("scheduled")):
            continue
        ts = datetime.strptime(h["date"], "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc).astimezone(TR)
        count += ts.date() == day
    return count


now = datetime.now(TR)
hours = todays_hours(now.date())
done = uploads_on(now.date())
due = sum(1 for h in hours if h <= now.hour)
run = done < due
print(f"Bugünün saatleri (TR): {hours} | şu an {now:%H:%M} | yüklenen {done} | gereken {due} -> {'ÇALIŞ' if run else 'atla'}")

out = os.environ.get("GITHUB_OUTPUT")
if out:
    with open(out, "a") as f:
        f.write(f"run={'true' if run else 'false'}\n")
