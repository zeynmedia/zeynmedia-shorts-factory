"""Topic scores from channel performance: views weighted by how much of the Short people watched.

Scores live in data/topic_scores.json (seeded from a YouTube Studio export) and are refreshed from the
YouTube Analytics API on every run when the token has the yt-analytics.readonly scope.
"""
import json
import os
import statistics
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCORES = ROOT / "data" / "topic_scores.json"
BASELINE_PCT = 50  # channel average viewed %; above it a view counts for more
MIN_VIEWS = 100
MATURE_DAYS = 3  # a Short collects most of its views in its first 3-4 days


def video_score(views, avg_pct):
    return views * min(2.0, max(0.5, avg_pct / BASELINE_PCT))


def topic_scores(history, per_video):
    """per_video: {video_id: (views, avg_pct)} -> {slug: mean score of its uploads}"""
    by_topic = {}
    for h in history:
        topic = h.get("topic") or ""
        young = h.get("date", "") > (date.today() - timedelta(days=MATURE_DAYS)).strftime("%Y%m%d")
        if topic.startswith("v2:") and h.get("video_id") in per_video and not young:
            by_topic.setdefault(topic[3:], []).append(per_video[h["video_id"]])
    out = {}
    for slug, vids in by_topic.items():
        # A same-day duplicate gets buried by YouTube (1-16 views); don't let it drag the topic down
        live = [v for v in vids if v[0] >= MIN_VIEWS] or vids
        out[slug] = round(statistics.mean(video_score(*v) for v in live))
    return out


def fetch_analytics():
    """{video_id: (views, avg_pct)} for the last 28 days, or None when the token can't read analytics."""
    if not os.environ.get("YT_REFRESH_TOKEN"):
        return None
    try:
        from googleapiclient.discovery import build
        from upload import credentials

        api = build("youtubeAnalytics", "v2", credentials=credentials(), cache_discovery=False)
        end = date.today()
        res = api.reports().query(
            ids="channel==MINE",
            startDate=(end - timedelta(days=28)).isoformat(),
            endDate=end.isoformat(),
            metrics="views,averageViewPercentage",
            dimensions="video",
            sort="-views",
            maxResults=200,
        ).execute()
        return {row[0]: (row[1], row[2]) for row in res.get("rows", [])}
    except Exception as e:  # missing scope, quota, API hiccup: keep the stored scores
        detail = getattr(e, "reason", "") or str(e)[:200]
        print(f"[perf] analytics okunamadı ({type(e).__name__}: {detail}), kayıtlı puanlar kullanılıyor")
        return None


def load_scores(history):
    stored = json.loads(SCORES.read_text(encoding="utf-8")) if SCORES.exists() else {}
    fresh = fetch_analytics()
    if fresh:
        stored.update(topic_scores(history, fresh))
        SCORES.write_text(json.dumps(dict(sorted(stored.items())), indent=2) + "\n", encoding="utf-8")
        print(f"[perf] {len(fresh)} videonun analitiği okundu")
    return stored
