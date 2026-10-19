[CmdletBinding()]
param(
    [ValidateSet('cpu','vulkan')][string]$Profile = 'cpu',
    [string]$Root = (Join-Path $env:LOCALAPPDATA 'BondsInferenceStaging')
)

$ErrorActionPreference = 'Stop'
$manifest = Get-Content (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$artifact = $manifest.engine.artifacts.$Profile
$release = Join-Path $Root ("releases/" + $manifest.engine.version + "-" + $Profile)
$archive = Join-Path $Root ("downloads/" + $artifact.filename)

New-Item -ItemType Directory -Force (Split-Path $archive), $release | Out-Null

if (-not (Test-Path $archive)) {
    Invoke-WebRequest -Uri $artifact.url -OutFile $archive
}

$hash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $artifact.sha256) {
    throw 'Engine checksum mismatch. Aborting without extraction.'
}

$marker = Join-Path $release 'installed.sha256'
$inventoryPath = Join-Path $release 'files.sha256.json'

if (Test-Path $marker) {
    if ((Get-Content $marker -Raw).Trim() -ne $hash) {
        throw 'Existing release marker differs; refuse overwrite.'
    }
    if (-not (Test-Path $inventoryPath)) {
        throw 'Release inventory missing; refuse reuse.'
    }
    Write-Output "Existing pinned release: $release"
    return
}

if (@(Get-ChildItem -Force $release).Count -gt 0) {
    throw 'Release directory is nonempty; refuse overwrite.'
}

Expand-Archive -Path $archive -DestinationPath $release
$exe = Get-ChildItem $release -Filter llama-server.exe -File -Recurse | Select-Object -First 1
if (-not $exe) {
    throw 'llama-server.exe missing from verified archive.'
}

$inventory = @(
    Get-ChildItem $release -Recurse -File | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($release.Length + 1)
            sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
)

ConvertTo-Json -InputObject $inventory -Depth 5 | Set-Content $inventoryPath
Set-Content -Path $marker -Value $hash -NoNewline
Write-Output "Verified staged release: $release"
