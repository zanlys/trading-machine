# Crypto Futures Scanner - Start Script
# Usage: trade start
# Ctrl+C to stop everything

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host "     Crypto Futures Scanner                " -ForegroundColor White
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host ""

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host "  Starting backend  (FastAPI :8000)..." -ForegroundColor Yellow

$backend = Start-Process -FilePath "python" `
    -ArgumentList "main.py" `
    -WorkingDirectory $Backend `
    -PassThru -WindowStyle Hidden

Write-Host "  Waiting." -NoNewline -ForegroundColor DarkGray
$waited = 0
while ($waited -lt 30) {
    Start-Sleep -Seconds 1
    $waited++
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    $code = cmd /c "curl.exe -s -o NUL -w ""%{http_code}"" --max-time 1 http://localhost:8000 2>NUL"
    if ($code -eq "200") { break }
}
Write-Host ""

if ($waited -ge 30) {
    Write-Host "  Backend failed to start." -ForegroundColor Red
    exit 1
}
Write-Host "  Backend ready!" -ForegroundColor Green

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host "  Starting frontend (Next.js  :3000)..." -ForegroundColor Yellow

$tmpLog = Join-Path $env:TEMP "nextjs_ready_$PID.tmp"

$frontend = Start-Process -FilePath "cmd" `
    -ArgumentList "/c set NO_COLOR=1 && set FORCE_COLOR=0 && npm run dev" `
    -WorkingDirectory $Frontend `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $tmpLog `
    -RedirectStandardError  "NUL"

Write-Host "  Waiting." -NoNewline -ForegroundColor DarkGray
$waited = 0
while ($waited -lt 40) {
    Start-Sleep -Seconds 1
    $waited++
    Write-Host "." -NoNewline -ForegroundColor DarkGray
    if (Test-Path $tmpLog) {
        $content = Get-Content $tmpLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "Ready|Local.*3000") { break }
    }
}
Write-Host ""

Write-Host "  Frontend ready!" -ForegroundColor Green

# ── Running ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [OK] Backend   " -NoNewline -ForegroundColor Green
Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "  [OK] Frontend  " -NoNewline -ForegroundColor Green
Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop..." -ForegroundColor DarkGray
Write-Host ""

# ── Wait — block terminal until Ctrl+C ───────────────────────────────────────
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Runs automatically when Ctrl+C is pressed
    Write-Host ""
    Write-Host "  Stopping services..." -ForegroundColor Yellow
    try { Stop-Process -Id $backend.Id  -Force -ErrorAction Stop } catch {}
    try { Stop-Process -Id $frontend.Id -Force -ErrorAction Stop } catch {}
    Start-Sleep -Milliseconds 500
    Remove-Item $tmpLog -Force -ErrorAction SilentlyContinue
    Write-Host "  Stopped." -ForegroundColor Green
    Write-Host ""
}
