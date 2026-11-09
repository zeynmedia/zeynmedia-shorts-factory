# Live stream secrets. Values are typed here and go straight to GitHub; nothing is written to disk.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
$repo = 'zeynmedia/zeynmedia-shorts-factory'

Write-Host "`n=== Stream key ===" -ForegroundColor Cyan
Write-Host "YouTube Studio > Go Live > Stream > Stream key (Copy)"
$k = Read-Host "Stream key'i yapistir ve Enter"
if ($k.Trim()) { $k.Trim() | gh secret set LIVE_STREAM_KEY -R $repo; Write-Host "LIVE_STREAM_KEY yazildi" -ForegroundColor Green }

Write-Host "`n=== Yayin hangi kanalda? ===" -ForegroundColor Cyan
$other = Read-Host "Ares Roket DISINDA bir kanalsa 'e' yaz (yorumlari okumak icin o kanala izin verilecek), Ares Roket ise Enter"
if ($other.Trim().ToLower() -eq 'e') {
	python scripts\get_refresh_token.py "G:\Downloads\client_secret_2_362147562311-3pcee81ictenr760e1ibqu5k27b9jhoi.apps.googleusercontent.com.json" --set-secrets $repo --prefix LIVE_
}
Write-Host "`nTamam, pencereyi kapatabilirsin." -ForegroundColor Green
