import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload


def credentials():
    # No scopes on refresh: the token keeps whatever was granted (upload, plus comments/analytics on newer tokens)
    return Credentials(
        token=None,
        refresh_token=os.environ["YT_REFRESH_TOKEN"],
        client_id=os.environ["YT_CLIENT_ID"],
        client_secret=os.environ["YT_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
    )


def _youtube():
    return build("youtube", "v3", credentials=credentials(), cache_discovery=False)


def upload_video(path, yt_meta, privacy="public", category_id="17"):
    body = {
        "snippet": {
            "title": yt_meta["title"],
            "description": yt_meta["description"],
            "tags": yt_meta["tags"],
            "categoryId": category_id,
            "defaultLanguage": os.environ.get("CONTENT_LANG", "tr"),
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(path), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    request = _youtube().videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[upload] %{int(status.progress() * 100)}")
    video_id = response["id"]
    print(f"[upload] yüklendi: https://youtube.com/shorts/{video_id}")
    return video_id


def post_comment(video_id, text):
    """Channel's own first comment (needs the youtube.force-ssl scope; skipped on older tokens)."""
    try:
        _youtube().commentThreads().insert(
            part="snippet",
            body={"snippet": {"videoId": video_id, "topLevelComment": {"snippet": {"textOriginal": text}}}},
        ).execute()
        print(f"[comment] yazıldı: {text}")
    except Exception as e:
        print(f"[comment] yazılamadı ({type(e).__name__}): token yorum iznine sahip değil olabilir")
