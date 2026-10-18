$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_DB)) {
    throw "BONDS_TOKEN_DB is required."
}

if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_ADMIN_SECRET_FILE)) {
    throw "BONDS_TOKEN_ADMIN_SECRET_FILE is required."
}

if (-not (Test-Path -LiteralPath $env:BONDS_TOKEN_ADMIN_SECRET_FILE)) {
    throw "BONDS_TOKEN_ADMIN_SECRET_FILE does not exist."
}

if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_BUILD_COMMIT)) {
    Write-Warning "BONDS_TOKEN_BUILD_COMMIT is not set; /health will report build_commit=unknown."
}

Set-Location $PSScriptRoot
python -m bonds_security.server
