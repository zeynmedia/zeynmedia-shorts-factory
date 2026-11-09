"""Bir kere lokalde çalıştır: YouTube refresh token'ı üretir.

Kullanım:
  pip install google-auth-oauthlib
  python scripts/get_refresh_token.py client_secret.json [--set-secrets owner/repo] [--prefix ZEYNEL_]
  --prefix ZEYNEL_ connects a second channel (Zeynel's studio line) without touching the main one

Web tipi OAuth client kullanıyorsan Google Cloud'da Authorized redirect URI olarak
http://localhost:8080/ ekli olmalı. Desktop tipi client'ta gerek yok.
"""
import argparse
import subprocess

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",  # channel's own comment under each Short
    "https://www.googleapis.com/auth/yt-analytics.readonly",  # topic scores from real retention
]

ap = argparse.ArgumentParser()
ap.add_argument("client_secret")
ap.add_argument("--set-secrets", metavar="OWNER/REPO", help="Değerleri gh CLI ile doğrudan repo secret'larına yaz")
ap.add_argument("--prefix", default="", help="Secret adlarının önüne eklenir, örn. ZEYNEL_ (ikinci kanal için)")
args = ap.parse_args()

flow = InstalledAppFlow.from_client_secrets_file(args.client_secret, SCOPES)
creds = flow.run_local_server(port=8080, access_type="offline", prompt="consent")
if not creds.refresh_token:
    raise SystemExit("Refresh token gelmedi; Google hesabındaki uygulama erişimini kaldırıp tekrar dene.")

values = {
    f"{args.prefix}YT_CLIENT_ID": creds.client_id,
    f"{args.prefix}YT_CLIENT_SECRET": creds.client_secret,
    f"{args.prefix}YT_REFRESH_TOKEN": creds.refresh_token,
}

if args.set_secrets:
    for name, value in values.items():
        subprocess.run(["gh", "secret", "set", name, "-R", args.set_secrets], input=value, text=True, check=True)
    print(f"3 secret {args.set_secrets} reposuna yazıldı.")
else:
    print("\nGitHub Secrets'a ekle:\n")
    for name, value in values.items():
        print(f"{name} = {value}")
