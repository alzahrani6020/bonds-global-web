# Foreground staging start. Close this shell or Ctrl+C to stop the engine.
[CmdletBinding()]
param([ValidateSet('cpu','vulkan')][string]$Profile='cpu',
[string]$Root=(Join-Path $env:LOCALAPPDATA 'BondsInferenceStaging'),
[Parameter(Mandatory=$true)][string]$ModelPath,
[ValidateRange(1,200)][int]$GpuLayers=0,
[ValidateRange(1024,65536)][int]$ContextSize=4096,
[ValidateRange(1,128)][int]$Threads=10,
[ValidateRange(1,32)][int]$Parallel=1,
[ValidateRange(1,65535)][int]$Port=18965)
$ErrorActionPreference='Stop'
$manifest=Get-Content (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($Port -eq 8765 -or $Port -eq 8771) {throw 'Protected production port'}
if ($Profile -eq 'cpu' -and $GpuLayers -ne 0) {throw 'CPU profile must use 0 GPU layers'}
if (-not (Test-Path $ModelPath -PathType Leaf)) {throw 'Missing model'}
$realModel=(Resolve-Path $ModelPath).Path
$modelHash=(Get-FileHash $realModel -Algorithm SHA256).Hash.ToLowerInvariant()
if ($modelHash -ne $manifest.model.sha256) {throw 'Canonical model checksum mismatch'}
$release=Join-Path $Root ("releases/" + $manifest.engine.version + "-" + $Profile)
$marker=Join-Path $release 'installed.sha256'
if (-not (Test-Path $marker)) {throw 'Pinned engine release missing; run install-engine.ps1'}
if ((Get-Content $marker -Raw).Trim() -ne $manifest.engine.artifacts.$Profile.sha256) {throw 'Pinned engine marker mismatch'}
# Verify every extracted executable/DLL against an authenticated file inventory, not just the archive marker.
$inventoryPath=Join-Path $release 'files.sha256.json'
if (-not (Test-Path $inventoryPath)) {throw 'Release file inventory missing; reinstall release'}
$inventory=Get-Content $inventoryPath -Raw | ConvertFrom-Json
foreach ($entry in $inventory) {
  $target=Join-Path $release $entry.path
  if (-not (Test-Path $target -PathType Leaf)) {throw "Missing release file: $($entry.path)"}
  if ((Get-FileHash $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {throw "Release file modified: $($entry.path)"}
}
$exe=Get-ChildItem $release -Filter llama-server.exe -Recurse -File | Select-Object -First 1
if (-not $exe) {throw 'llama-server.exe missing'}
$occupied=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($occupied) {throw "Port $Port already in use"}
$logDir=Join-Path $Root 'logs';New-Item -ItemType Directory -Force $logDir|Out-Null
Write-Output "STAGING ONLY: loopback $Port, $Profile layers=$GpuLayers"
# Explicit runtime configuration. No production service registration.
& $exe.FullName --host 127.0.0.1 --port $Port --model $realModel --ctx-size $ContextSize --threads $Threads --parallel $Parallel --n-gpu-layers $GpuLayers 2>&1 | Tee-Object -FilePath (Join-Path $logDir ("llama-" + $Profile + ".log")) -Append
if ($LASTEXITCODE -ne 0) {throw "llama-server failed with exit code $LASTEXITCODE"}
