param(
    [string]$DestinationDirectory = "$env:ProgramData\BondsNative\models"
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this provisioning script from an elevated PowerShell window."
}

$serviceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $serviceRoot "canonical-model.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
$destination = Join-Path $DestinationDirectory ([string]$manifest.artifact)

$revision = [string]$manifest.source_revision
$repo = [string]$manifest.source_repository
$artifact = [string]$manifest.artifact
$url = "https://huggingface.co/$repo/resolve/$revision/$artifact?download=true"

if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
    Write-Host "Downloading canonical Bonds Native artifact..."
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination
}

$actual = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
$expected = ([string]$manifest.sha256).ToLowerInvariant()
if ($actual -ne $expected) {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
    throw "Canonical GGUF SHA256 mismatch. Expected $expected, got $actual."
}

$sidecar = "$destination.sha256"
Set-Content -LiteralPath $sidecar -Value "$expected  $artifact" -Encoding ASCII

Write-Host "Canonical Bonds Native model provisioned."
Write-Host "Artifact: $destination"
Write-Host "SHA256:   $actual"
Write-Host "License:  $($manifest.license)"
