param()

$ErrorActionPreference = "Stop"

$exe = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", "Machine")
$config = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", "Machine")
$tunnel = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_TUNNEL", "Machine")

if ([string]::IsNullOrWhiteSpace($exe)) { throw "BONDS_CLOUDFLARED_EXE is not configured." }
if ([string]::IsNullOrWhiteSpace($config)) { throw "BONDS_CLOUDFLARED_CONFIG is not configured." }
if ([string]::IsNullOrWhiteSpace($tunnel)) { throw "BONDS_CLOUDFLARED_TUNNEL is not configured." }

& $exe tunnel --config $config run $tunnel
exit $LASTEXITCODE
