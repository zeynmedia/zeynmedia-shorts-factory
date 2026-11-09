"""Production run: topic -> assets -> music hook -> render -> Release files -> YouTube.

Usage: python v2/factory/produce.py [--topic SLUG] [--engine v2|studio] [--music-dir PATH] [--skip-upload]
Engines: "v2" = Remotion SKILLER templates, "studio" = Zeynel's studio/index.html with config/style_zeynel.json.
Topics live in v2/topics/*.json (verified data + SKILLER-style title). Music comes from the
private zeynmedia-music checkout; each track's start second is read from its library.json.
"""
import argparse
import base64
import json
import math
import os
import random
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

V2 = Path(__file__).resolve().parent.parent
ROOT = V2.parent
sys.path.insert(0, str(V2 / "scripts"))
sys.path.insert(0, str(ROOT / "factory"))

from fetch_assets import build_props, load_index, save_index  # noqa: E402
from performance import load_scores  # noqa: E402

TOPICS = V2 / "topics"
HISTORY = ROOT / (os.environ.get("HISTORY_FILE") or "data/history.json")  # each production line keeps its own
OUT = ROOT / "output"
PUBLIC_MUSIC = V2 / "public" / "music"
MUSIC_REPEAT_GAP = 12
RECENT_GAP = 6  # topics from the last 6 uploads sit out
MAX_STEPS = 10  # more steps than this in 18 s and the gains flash by too fast to read
STUDIO_STYLE = ROOT / "config" / "style_zeynel.json"
BASS_SFX = {
    "tick": ["deep_tick.mp3"],
    "whoosh": ["sub_whoosh.mp3"],
    "impact": ["sub_boom.mp3"],
    "win": ["bass_drop.mp3"],
}


def load_history():
    try:
        return json.loads(HISTORY.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def pick_topic(history, forced):
    topics = sorted(p.stem for p in TOPICS.glob("*.json"))
    if forced:
        if forced not in topics:
            sys.exit(f"konu yok: {forced} (var olanlar: {', '.join(topics)})")
        return forced
    # Skip the last few topics, then pick weighted by past performance; topics without data get the median
    # so new ones still get tried. Shorts live ~3-4 days, so a strong topic can come back after a week.
    used = [(h.get("topic") or "").removeprefix("v2:") for h in history if h.get("video_id")]
    recent = set(used[-RECENT_GAP:])
    pool = [t for t in topics if t not in recent] or topics
    scores = load_scores(history)
    known = sorted(scores[t] for t in topics if t in scores) or [1]
    median = known[len(known) // 2]
    weights = [max(1, scores.get(t, median)) for t in pool]
    pick = random.choices(pool, weights=weights)[0]
    print(f"[v2] konu puanları: " + ", ".join(f"{t}={w}" for t, w in sorted(zip(pool, weights), key=lambda x: -x[1])[:6]))
    return pick


def debate_comment(spec):
    """Channel's first comment: a question people can answer in one word, plus the next-video hook."""
    names = [e["name"] for e in spec["entities"]]
    if len(names) <= 3:
        ask = " or ".join([", ".join(names[:-1]), names[-1]]) if len(names) > 2 else " or ".join(names)
        question = f"{ask}? Who's the real GOAT? 🐐👇"
    else:
        question = "Who should be #1 on this list? Drop your pick 👇"
    return f"{question}\nWhich rivalry should we race next? 🏁"


def pick_music(history, music_dir):
    if not music_dir:
        return None
    lib = json.loads((music_dir / "library.json").read_text(encoding="utf-8"))
    tracks = [t for t in lib if not t.get("excluded") and (music_dir / t["file"]).exists()]
    if not tracks:
        return None
    recent = {h.get("music") for h in history[-MUSIC_REPEAT_GAP:]}
    pool = [t for t in tracks if t["file"] not in recent] or tracks
    track = random.choice(pool)
    PUBLIC_MUSIC.mkdir(parents=True, exist_ok=True)
    # Fixed ASCII name: track titles carry spaces/unicode that would need URL escaping in staticFile
    shutil.copy2(music_dir / track["file"], PUBLIC_MUSIC / f"current{Path(track['file']).suffix.lower()}")
    return track


def _range_label(a, b):
    if a == b:
        return a
    if a.isdigit() and b.isdigit():
        return f"{a}-{b[-2:]}"
    if a.endswith("s") and b.endswith("s") and a[:-1].isdigit():
        return f"{a[:-1]}-{b[-3:]}"
    return b


def compact_steps(steps, max_steps=MAX_STEPS):
    """Merges consecutive steps (summing values) so each one stays on screen long enough."""
    if len(steps) <= max_steps:
        return steps
    size = math.ceil(len(steps) / max_steps)
    out = []
    for i in range(0, len(steps), size):
        group = steps[i : i + size]
        values = {}
        for st in group:
            for k, v in st["values"].items():
                values[k] = values.get(k, 0) + v
        out.append({"label": _range_label(group[0]["label"], group[-1]["label"]), "values": values})
    return out


def _data_url(rel):
    if not rel:
        return ""
    path = V2 / "public" / rel
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def render_studio(props, track, music_dir, out_path):
    """Renders with Zeynel's own studio page (factory/render.py frame-steps it) using his saved preset."""
    from render import INTRO_S, OUTRO_S, render_video

    entities = [e for e in props["entities"] if not e.get("others")]
    pid = {e["id"]: f"p{i + 1}" for i, e in enumerate(entities)}
    content = {
        "headerTitle": props["title"],
        "headerSubtitle": props["subtitle"],
        "players": {
            pid[e["id"]]: {
                "name": e["name"],
                "searchName": e["name"],
                "image": _data_url(e.get("image") or e.get("badge") or e.get("flag")),
                "logo": _data_url(e.get("flag") if (e.get("image") or e.get("badge")) else ""),
                "color": e.get("color") if e.get("color", "#ffffff").lower() != "#ffffff" else "#2563eb",
            }
            for e in entities
        },
        "statsData": [{"label": st["label"], **{pid[k]: v for k, v in st["values"].items() if k in pid}} for st in props["steps"]],
        "style": json.loads(STUDIO_STYLE.read_text(encoding="utf-8")),
        "sfx": {kind: [V2 / "public" / "sfx" / f for f in files] for kind, files in BASS_SFX.items()},
    }
    if track:
        content["music"] = {"path": str(music_dir / track["file"]), "start": track["start"]}
    # Whole video stays at durationSec: studio intro + animation + outro
    render_video(content, out_path, props["durationSec"] - INTRO_S - OUTRO_S)


def render(props, out_path):
    props_path = OUT / "props.json"
    props_path.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    cmd = ["npx", "remotion", "render", "src/index.ts", "Short", str(out_path), f"--props={props_path}", "--log=warn"]
    subprocess.run(cmd, cwd=V2, check=True, shell=os.name == "nt")
    props_path.unlink()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", default=os.environ.get("INPUT_TOPIC") or None)
    ap.add_argument("--music-dir", default=os.environ.get("MUSIC_DIR"))
    ap.add_argument("--engine", choices=["v2", "studio"], default=os.environ.get("ENGINE") or "v2")
    ap.add_argument("--skip-upload", action="store_true", default=os.environ.get("SKIP_UPLOAD", "").lower() == "true")
    args = ap.parse_args()

    history = load_history()
    slug = pick_topic(history, args.topic)
    spec = json.loads((TOPICS / f"{slug}.json").read_text(encoding="utf-8"))
    print(f"[v2] konu: {slug} ({spec['props']['template']}, motor: {args.engine})")

    index = load_index()
    try:
        props = build_props(spec, index)
    finally:
        save_index(index)
    props["steps"] = compact_steps(props["steps"])

    track = pick_music(history, Path(args.music_dir) if args.music_dir else None)
    if track:
        props.update(music=f"music/current{Path(track['file']).suffix.lower()}", musicStart=track["start"])
        print(f"[v2] müzik: {track['file']} @ {track['start']}s ({track.get('method')})")
    else:
        print("[v2] müzik yok, sadece efektlerle render")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    OUT.mkdir(exist_ok=True)
    video = OUT / f"{stamp}-{slug}.mp4"
    if args.engine == "studio":
        render_studio(props, track, Path(args.music_dir) if args.music_dir else None, video)
    else:
        render(props, video)
    print(f"[v2] render bitti: {video} ({video.stat().st_size / 1e6:.1f} MB)")

    yt = spec["youtube"]
    video_id = None
    if not args.skip_upload:
        from upload import post_comment, upload_video

        video_id = upload_video(video, yt, privacy=os.environ.get("YT_PRIVACY", "public"))
        post_comment(video_id, debate_comment(spec))

    meta = {
        "topic": f"v2:{slug}",
        "headerTitle": props["title"],
        "headerSubtitle": props["subtitle"],
        "template": props["template"] if args.engine == "v2" else "studio",
        "music": track["file"] if track else None,
        "musicStart": track["start"] if track else None,
        "youtube": yt,
        "video_id": video_id,
    }
    (OUT / f"{stamp}-{slug}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    if not os.environ.get("GITHUB_ACTIONS") and not video_id:
        return  # local preview renders don't count as published videos
    entry = {"date": stamp, "topic": meta["topic"], "title": yt["title"], "video_id": video_id, "music": meta["music"], "engine": args.engine, "scheduled": os.environ.get("GITHUB_EVENT_NAME") == "schedule" or os.environ.get("VIA_CRON") == "true"}
    # The workflow re-applies this entry on top of the latest origin history (see append_history.py)
    (OUT / "history-entry.json").write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    history.append(entry)
    HISTORY.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
