# Staging-only, user-scoped files. Never modifies Windows services or production.
[CmdletBinding()]
param([ValidateSet('cpu','vulkan')][string]$Profile='cpu', [string]$Root=(Join-Path $env:LOCALAPPDATA 'BondsInferenceStaging'))
$ErrorActionPreference='Stop'
$manifest=Get-Content (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$artifact=$manifest.engine.artifacts.$Profile
$release=Join-Path $Root ("releases/" + $manifest.engine.version + "-" + $Profile)
$archive=Join-Path $Root ("downloads/" + $artifact.filename)
New-Item -ItemType Directory -Force (Split-Path $archive),$release | Out-Null
if (-not (Test-Path $archive)) { Invoke-WebRequest -Uri $artifact.url -OutFile $archive }
$hash=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $artifact.sha256) { throw "Engine checksum mismatch. Aborting without extraction." }
if (Test-Path (Join-Path $release 'installed.sha256')) {
  if ((Get-Content (Join-Path $release 'installed.sha256') -Raw).Trim() -ne $hash) {throw 'Existing release marker differs; refuse overwrite'}
  Write-Output "Existing pinned release: $release"; return
}
if (@(Get-ChildItem -Force $release).Count -gt 0) {throw 'Release directory is nonempty; refuse overwrite'}
Expand-Archive -Path $archive -DestinationPath $release
$exe=Get-ChildItem $release -Filter llama-server.exe -File -Recurse | Select-Object -First 1
if (-not $exe) {throw 'llama-server.exe missing from verified archive'}
Set-Content -Path (Join-Path $release 'installed.sha256') -Value $hash -NoNewline
Write-Output "Verified staged release: $release"
