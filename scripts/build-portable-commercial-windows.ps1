param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$package = Join-Path $root 'lib/portable-intelligence'
if (!(Test-Path (Join-Path $package 'package.json'))) { throw 'PORTABLE_PACKAGE_NOT_FOUND' }
if (-not [System.IO.Path]::IsPathRooted($OutputDirectory)) { throw 'ABSOLUTE_OUTPUT_REQUIRED' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$version = (& $node --version)
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v2[4-9]\.') { throw 'NODE_24_OR_NEWER_REQUIRED' }
$buildId = (git -C $root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $buildId -notmatch '^[0-9a-f]{40}$') { throw 'SOURCE_SHA_REQUIRED' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stage = Join-Path $OutputDirectory 'customer-portable-test'
if (Test-Path $stage) { throw 'BUNDLE_PATH_ALREADY_EXISTS' }
New-Item -ItemType Directory -Path $stage | Out-Null
$manifest = Get-Content (Join-Path $package 'package.json') -Raw | ConvertFrom-Json
foreach ($name in $manifest.files) {
  $source = Join-Path $package $name
  if (!(Test-Path $source)) { throw "MISSING_BUNDLE_FILE: $name" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $stage $name)
}
Copy-Item -LiteralPath (Join-Path $package 'package.json') -Destination (Join-Path $stage 'package.json')
Copy-Item -LiteralPath $node -Destination (Join-Path $stage 'node.exe')
Push-Location $stage
try {
  & $npm install --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'DEPENDENCY_INSTALL_FAILED' }
  & (Join-Path $stage 'node.exe') --version
  if ($LASTEXITCODE -ne 0) { throw 'BUNDLED_NODE_FAILED' }
  & (Join-Path $stage 'node.exe') -e "require('./commercial-server');require('./licensed-commercial-workflow');require('./file-adapters');console.log('LOCAL_MODULE_LOAD_PASS')"
  if ($LASTEXITCODE -ne 0) { throw 'BUNDLED_MODULE_LOAD_FAILED' }
}
finally { Pop-Location }
$metadata = @{
  release_status = 'TEST_ONLY_NOT_SIGNED'
  source_sha = $buildId
  node_version = $version
  supports = @('reviewed import','local tenant roles','licensed loopback interface','encrypted backups')
  missing = @('vendor code-signing certificate','bundled Windows OCR binaries','commercial customer machine acceptance')
} | ConvertTo-Json -Depth 4
Set-Content -LiteralPath (Join-Path $stage 'BUILD-MANIFEST.json') -Value $metadata -Encoding utf8
$zip = Join-Path $OutputDirectory ('bonds-commercial-test-' + $buildId.Substring(0,12) + '.zip')
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
Write-Host "BUNDLE_TEST_ONLY: $zip"
Write-Host "BUNDLE_SHA256: $hash"
