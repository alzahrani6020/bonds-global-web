# Local preview: Python http.server (preferred) or npx serve. Opens browser.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root
$Port = 3000

$markPath = Join-Path $Root 'assets\site-logo.png'
if (-not (Test-Path -LiteralPath $markPath)) {
  $markPath = Join-Path $Root 'assets\site-logo.jpg'
}
if (-not (Test-Path -LiteralPath $markPath)) {
  Write-Host ''
  Write-Host 'TIP: Add assets\site-logo.png or site-logo.jpg for the header/footer logo.' -ForegroundColor Yellow
  Write-Host ''
}

function Invoke-ServerCmd {
  param([string]$Command)
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $Command) -WorkingDirectory $Root | Out-Null
}

$pythonExe = $null
foreach ($name in @('python', 'py')) {
  try {
    $c = Get-Command $name -ErrorAction Stop
    $pythonExe = $c.Source
    break
  } catch { }
}

if ($pythonExe) {
  Write-Host "Starting: $pythonExe -m http.server $Port" -ForegroundColor Green
  $inner = "cd /d `"$Root`" && `"$pythonExe`" -m http.server $Port"
  Invoke-ServerCmd -Command $inner
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
  Write-Host "Starting: npx serve --listen $Port" -ForegroundColor Green
  $inner = "cd /d `"$Root`" && npx --yes serve --listen $Port ."
  Invoke-ServerCmd -Command $inner
} else {
  Write-Host 'ERROR: Install Python (python.org) or Node.js (nodejs.org) so python or npx is available.' -ForegroundColor Red
  exit 1
}

Write-Host 'Waiting for server...' -ForegroundColor Gray
Start-Sleep -Seconds 5
$url = "http://127.0.0.1:$Port/"
Write-Host "Opening: $url" -ForegroundColor Cyan
Start-Process $url
