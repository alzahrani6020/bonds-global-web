# Pull a small Ollama model then start interactive chat. Run: powershell -File ollama-start-chat.ps1
$ErrorActionPreference = "Stop"
$ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
if (-not (Test-Path -LiteralPath $ollama)) {
    Write-Host "Ollama not found at:" $ollama -ForegroundColor Red
    exit 1
}

$model = "llama3.2:1b"
Write-Host "Pulling $model (may take a few minutes)..." -ForegroundColor Cyan
& $ollama pull $model
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pull failed. Try: ollama pull $model" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Starting chat. Type /bye to exit." -ForegroundColor Green
& $ollama run $model
