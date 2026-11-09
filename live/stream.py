"""Chat Decides live stream: renders live/index.html in Chromium on an Xvfb display, pushes it to YouTube
over RTMP with ffmpeg (royalty-free music underneath) and feeds the live chat into the page as votes.

Env: LIVE_STREAM_KEY (required), LIVE_MINUTES (default 60), LIVE_ROUND_S (default 300),
     LIVE_YT_CLIENT_ID / LIVE_YT_CLIENT_SECRET / LIVE_YT_REFRESH_TOKEN for reading chat (optional:
     without them the stream still runs, it just can't count votes), DISPLAY (Xvfb).
"""
import json
import os
import random
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
W, H, FPS = 1080, 1920, 30
CHAT_MIN_POLL_S = 6  # liveChatMessages.list costs quota; YouTube's own interval is usually shorter


def log(*a):
    print("[live]", *a, flush=True)


def access_token():
    cid, secret, refresh = (os.environ.get(k) for k in ("LIVE_YT_CLIENT_ID", "LIVE_YT_CLIENT_SECRET", "LIVE_YT_REFRESH_TOKEN"))
    if not (cid and secret and refresh):
        return None
    body = urllib.parse.urlencode({"client_id": cid, "client_secret": secret, "refresh_token": refresh, "grant_type": "refresh_token"}).encode()
    with urllib.request.urlopen("https://oauth2.googleapis.com/token", body, timeout=20) as r:
        return json.load(r)["access_token"]


def yt(token, path, **params):
    url = "https://www.googleapis.com/youtube/v3/" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def find_chat_id(token):
    res = yt(token, "liveBroadcasts", part="snippet", broadcastStatus="active", broadcastType="all")
    for b in res.get("items", []):
        if b["snippet"].get("liveChatId"):
            log("yayın:", b["snippet"].get("title"))
            return b["snippet"]["liveChatId"]
    return None


def music_list():
    tracks = sorted((REPO / "assets" / "music").glob("*.mp3"))
    random.shuffle(tracks)
    lst = ROOT / "music.txt"
    # Long enough for 6 hours; ffmpeg's concat demuxer plays them back to back
    lst.write_text("".join(f"file '{t.as_posix()}'\n" for _ in range(60) for t in tracks), encoding="utf-8")
    return lst


def start_ffmpeg(key):
    display = os.environ.get("DISPLAY", ":99")
    cmd = [
        "ffmpeg", "-loglevel", os.environ.get("LIVE_FFMPEG_LOG", "warning"), "-nostdin",
        "-f", "x11grab", "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-draw_mouse", "0", "-i", f"{display}+0,0",
        "-f", "concat", "-safe", "0", "-i", str(music_list()),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
        "-b:v", "6000k", "-maxrate", "6000k", "-bufsize", "12000k", "-g", str(FPS * 2), "-keyint_min", str(FPS * 2),
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-af", "volume=0.35",
        "-f", "flv", f"rtmp://a.rtmp.youtube.com/live2/{key}",
    ]
    return subprocess.Popen(cmd)


def main():
    key = os.environ.get("LIVE_STREAM_KEY")
    if not key:
        sys.exit("LIVE_STREAM_KEY yok")
    minutes = float(os.environ.get("LIVE_MINUTES") or 60)
    round_s = int(os.environ.get("LIVE_ROUND_S") or 300)
    end_at = time.time() + minutes * 60

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,
            args=[f"--window-size={W},{H}", "--window-position=0,0", "--kiosk", "--hide-scrollbars", "--disable-infobars", "--noerrdialogs"],
        )
        page = browser.new_page(viewport={"width": W, "height": H})
        # The page and its assets are served from the repo so relative asset paths resolve
        page.goto((ROOT / "index.html").as_uri() + f"?round={round_s}")
        page.wait_for_timeout(3000)  # fonts and faces
        ff = start_ffmpeg(key)
        log(f"yayın başladı, {minutes:.0f} dk")

        token, chat_id, page_token, next_poll, token_at = None, None, None, 0, 0
        votes = 0
        while time.time() < end_at:
            if ff.poll() is not None:
                log(f"ffmpeg durdu (çıkış kodu {ff.returncode}), yeniden başlatılıyor")
                time.sleep(3)
                ff = start_ffmpeg(key)
            now = time.time()
            if now >= next_poll:
                next_poll = now + CHAT_MIN_POLL_S
                try:
                    if not token or now - token_at > 3000:
                        token, token_at = access_token(), now
                    if token and not chat_id:
                        chat_id = find_chat_id(token)  # appears once YouTube has picked up the stream
                        if not chat_id:
                            next_poll = now + 15
                    if token and chat_id:
                        params = {"liveChatId": chat_id, "part": "snippet,authorDetails", "maxResults": 200}
                        if page_token:
                            params["pageToken"] = page_token
                        res = yt(token, "liveChat/messages", **params)
                        first = page_token is None  # backlog from before we joined doesn't count
                        page_token = res.get("nextPageToken")
                        next_poll = now + max(CHAT_MIN_POLL_S, res.get("pollingIntervalMillis", 0) / 1000)
                        for m in [] if first else res.get("items", []):
                            text = m["snippet"].get("displayMessage") or ""
                            user = m["authorDetails"].get("displayName") or "someone"
                            if page.evaluate("([u, t]) => window.chatMessage(u, t)", [user, text]):
                                votes += 1
                except Exception as e:  # network or quota hiccup: keep streaming, retry later
                    log("chat hatası:", type(e).__name__, str(e)[:160])
                    next_poll = now + 30
            time.sleep(0.5)

        log(f"süre doldu, {votes} oy sayıldı")
        ff.terminate()
        try:
            ff.wait(10)
        except subprocess.TimeoutExpired:
            ff.kill()
        browser.close()


if __name__ == "__main__":
    main()
