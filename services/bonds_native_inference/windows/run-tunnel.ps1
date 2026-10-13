param()

$ErrorActionPreference = "Stop"

$exe = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", "Machine")
$config = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", "Machine")
$tunnel = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_TUNNEL", "Machine")
$stateDir = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_STATE_DIR", "Machine")
if ([string]::IsNullOrWhiteSpace($stateDir)) { $stateDir = Join-Path $env:ProgramData "BondsNative" }
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$logPath = Join-Path $stateDir "cloudflared.log"

if ([string]::IsNullOrWhiteSpace($exe)) { throw "BONDS_CLOUDFLARED_EXE is not configured." }
if ([string]::IsNullOrWhiteSpace($config)) { throw "BONDS_CLOUDFLARED_CONFIG is not configured." }
if ([string]::IsNullOrWhiteSpace($tunnel)) { throw "BONDS_CLOUDFLARED_TUNNEL is not configured." }

Add-Content -LiteralPath $logPath -Value ("{0:o} starting tunnel {1}" -f (Get-Date), $tunnel)
& $exe tunnel --config $config run $tunnel *>> $logPath
$code = $LASTEXITCODE
Add-Content -LiteralPath $logPath -Value ("{0:o} tunnel exited {1}" -f (Get-Date), $code)
exit $code
