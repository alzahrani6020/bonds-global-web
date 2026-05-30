# === Bonds Diagnostic Script ===
$site = "https://bonds-global.com"
$supabaseUrl = "https://hutxsqzplyuqgnghsrcs.supabase.co"

Write-Host "===== Bonds Diagnostic =====" -ForegroundColor Cyan

# 1. Check website
Write-Host "`n[1] Checking website..." -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$site/calculators/auth/profile.html" -Method HEAD -UseBasicParsing -TimeoutSec 10
    Write-Host "  Website: OK ($($resp.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Website: FAILED" -ForegroundColor Red
}

# 2. Check auth-guard.js version
Write-Host "`n[2] Checking auth-guard.js..." -ForegroundColor Yellow
try {
    $js = Invoke-WebRequest -Uri "$site/auth-guard.js?v=3" -UseBasicParsing -TimeoutSec 10
    $hasProfile = $js.Content.Contains('getProfile')
    $hasDownload = $js.Content.Contains('download(pathMatch[1])')
    if ($hasProfile -and $hasDownload) {
        Write-Host "  auth-guard.js: LATEST (has profile fetch + download fallback)" -ForegroundColor Green
    } elseif ($hasProfile) {
        Write-Host "  auth-guard.js: PARTIAL (has profile fetch, no download)" -ForegroundColor Yellow
    } else {
        Write-Host "  auth-guard.js: OLD (no profile fetch)" -ForegroundColor Red
    }
} catch {
    Write-Host "  auth-guard.js: FAILED to fetch" -ForegroundColor Red
}

# 3. Check Supabase Storage bucket
Write-Host "`n[3] Checking Supabase Storage..." -ForegroundColor Yellow
try {
    $bucketResp = Invoke-WebRequest -Uri "$supabaseUrl/storage/v1/bucket/avatars" -Method HEAD -UseBasicParsing -TimeoutSec 10
    Write-Host "  Bucket 'avatars': EXISTS ($($bucketResp.StatusCode))" -ForegroundColor Green
} catch {
    $err = $_.Exception.Response.StatusCode.value__
    if ($err -eq 404) {
        Write-Host "  Bucket 'avatars': NOT FOUND (404)" -ForegroundColor Red
    } elseif ($err -eq 400) {
        Write-Host "  Bucket 'avatars': BAD REQUEST (400) — might need auth" -ForegroundColor Yellow
    } else {
        Write-Host "  Bucket 'avatars': ERROR ($err)" -ForegroundColor Red
    }
}

# 4. Summary
Write-Host "`n===== Summary =====" -ForegroundColor Cyan
Write-Host "If auth-guard.js shows OLD, clear browser cache (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "If bucket shows 400, the bucket exists but is not public" -ForegroundColor White
Write-Host "`nFor full diagnosis, open browser console (F12) and run:" -ForegroundColor Cyan
Write-Host "  (await BondsAuth.getProfile((await BondsAuth.getSession()).data.session.user.id)).data" -ForegroundColor Gray

Read-Host "`nPress Enter to exit"
