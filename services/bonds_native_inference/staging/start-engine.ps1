[CmdletBinding()]
param(
    [ValidateSet('cpu','vulkan')][string]$Profile = 'cpu',
    [string]$Root = (Join-Path $env:LOCALAPPDATA 'BondsInferenceStaging'),
    [Parameter(Mandatory = $true)][string]$ModelPath,
    [Nullable[int]]$GpuLayers = $null,
    [ValidateRange(1,32)][int]$Parallel = 1,
    [ValidateRange(1,65535)][int]$Port = 18965
)

$ErrorActionPreference = 'Stop'
$manifest = Get-Content (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$canonicalPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'canonical-model.json'
$canonical = Get-Content $canonicalPath -Raw | ConvertFrom-Json

if ($Port -eq 8765 -or $Port -eq 8771) {
    throw 'Protected production port.'
}
if (-not (Test-Path $ModelPath -PathType Leaf)) {
    throw 'Missing model.'
}

$effectiveGpuLayers = if ($null -eq $GpuLayers) {
    if ($Profile -eq 'cpu') { 0 } else { [int]$canonical.runtime.n_gpu_layers }
} else {
    [int]$GpuLayers
}
if ($effectiveGpuLayers -lt -1 -or $effectiveGpuLayers -gt 200) {
    throw 'GpuLayers must be between -1 and 200.'
}
if ($Profile -eq 'cpu' -and $effectiveGpuLayers -ne 0) {
    throw 'CPU profile must use 0 GPU layers.'
}

$realModel = (Resolve-Path $ModelPath).Path
if ((Split-Path -Leaf $realModel) -ne [string]$canonical.artifact) {
    throw "Model filename must match canonical artifact $($canonical.artifact)."
}
$modelHash = (Get-FileHash $realModel -Algorithm SHA256).Hash.ToLowerInvariant()
if ($modelHash -ne ([string]$canonical.sha256).ToLowerInvariant()) {
    throw 'Canonical model checksum mismatch.'
}

$release = Join-Path $Root ("releases/" + $manifest.engine.version + "-" + $Profile)
$marker = Join-Path $release 'installed.sha256'
$inventoryPath = Join-Path $release 'files.sha256.json'

if (-not (Test-Path $marker)) {
    throw 'Pinned engine release missing; run install-engine.ps1.'
}
if ((Get-Content $marker -Raw).Trim() -ne $manifest.engine.artifacts.$Profile.sha256) {
    throw 'Pinned engine marker mismatch.'
}
if (-not (Test-Path $inventoryPath)) {
    throw 'Release file inventory missing; reinstall release.'
}

$inventory = Get-Content $inventoryPath -Raw | ConvertFrom-Json
foreach ($entry in $inventory) {
    $target = Join-Path $release $entry.path
    if (-not (Test-Path $target -PathType Leaf)) {
        throw "Missing release file: $($entry.path)"
    }
    if ((Get-FileHash $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
        throw "Release file modified: $($entry.path)"
    }
}

$exe = Get-ChildItem $release -Filter llama-server.exe -Recurse -File | Select-Object -First 1
if (-not $exe) {
    throw 'llama-server.exe missing.'
}

$occupied = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($occupied) {
    throw "Port $Port already in use."
}

$logDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null

$args = @(
    '--host', '127.0.0.1',
    '--port', [string]$Port,
    '--model', $realModel,
    '--ctx-size', [string]([int]$canonical.runtime.n_ctx),
    '--threads', [string]([int]$canonical.runtime.n_threads),
    '--parallel', [string]$Parallel,
    '--n-gpu-layers', [string]$effectiveGpuLayers,
    '--temp', [string]([double]$canonical.runtime.temperature)
)

Write-Output "STAGING ONLY: loopback $Port, profile=$Profile gpu_layers=$effectiveGpuLayers"
& $exe.FullName @args 2>&1 | Tee-Object -FilePath (Join-Path $logDir ("llama-" + $Profile + ".log")) -Append

if ($LASTEXITCODE -ne 0) {
    throw "llama-server failed with exit code $LASTEXITCODE"
}
