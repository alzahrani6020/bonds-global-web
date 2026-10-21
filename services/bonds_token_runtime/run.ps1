$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_DB)) {
    throw "BONDS_TOKEN_DB is required."
}

foreach ($name in @("BONDS_TOKEN_ADMIN_SECRET_FILE", "BONDS_TOKEN_CHANNEL_SECRET_FILE")) {
    $path = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "$name must point to an existing secret file."
    }
}

Set-Location $PSScriptRoot
python -m bonds_security.server --check-config
if ($LASTEXITCODE -ne 0) {
    throw "Token runtime configuration is invalid. No runtime was started."
}
python -m bonds_security.server
exit $LASTEXITCODE
