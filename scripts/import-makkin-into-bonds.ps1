# BONDS-root-only SCC380 source import (PowerShell 5.1+).
# No external local directories, runtime database access, deployment or secret transfer.
[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$SourceRef = 'main',
  [string]$SourceUrl = 'https://github.com/alzahrani6020/scc380.git'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = Join-Path $root 'integrations\makkin\source'
$stageParent = Join-Path $root '.makkin-import'
$stage = Join-Path $stageParent ('source-' + [guid]::NewGuid().ToString('N'))
$manifestPath = Join-Path $root 'integrations\makkin\import-manifest.json'
$skip = New-Object 'System.Collections.Generic.List[string]'
$copied = New-Object 'System.Collections.Generic.List[object]'
function Assert-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required executable missing: $name"
  }
}
function Is-Excluded([string]$relative) {
  $s = $relative.Replace('\','/')
  $parts = $s.Split('/')
  foreach ($part in $parts) {
    if ($part -match '^(?i:\.env(?:\..*)?|\.git|node_modules|\.next|dist|build|coverage|\.vercel|\.cache|__pycache__|\.ssh|secrets?)$') { return $true }
  }
  if ($s -match '(?i)(^|/)(?:id_rsa|id_ed25519|credentials(?:\.[^/]*)?|service-account(?:\.[^/]*)?|\.npmrc|\.pypirc|\.netrc|\.dockerconfigjson)(?:$|\.)') { return $true }
  if ($s -match '(?i)\.(?:pem|p12|pfx|key|keystore|jks|asc|kdbx|sqlite|sqlite3|db|dump|bak|backup)$') { return $true }
  return $false
}
Assert-Command 'git'
if (-not (Test-Path (Join-Path $root '.git'))) { throw "BONDS Git root not found: $root" }
$actualRoot = (& git -C $root rev-parse --show-toplevel 2>&1)
if ($LASTEXITCODE -ne 0 -or ([IO.Path]::GetFullPath([string]$actualRoot).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($root).TrimEnd('\','/'))) {
  throw 'Run this script from its original BONDS repository; nested or copied folders are not permitted.'
}
if ($SourceUrl -ne 'https://github.com/alzahrani6020/scc380.git') {
  throw 'Source URL is pinned to the owned SCC380 repository.'
}
if ($SourceRef -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,120}$' -or $SourceRef.Contains('..') -or $SourceRef.Contains('@{')) {
  throw 'Invalid source ref.'
}
if (Test-Path $target) { throw "Existing imported source detected. No overwrite permitted: $target" }
if (Test-Path $manifestPath) { throw "Existing import manifest detected. No overwrite permitted: $manifestPath" }
if (-not $Apply) {
  Write-Host "DRY RUN (no files changed). BONDS root: $root"
  Write-Host "Source: $SourceUrl ref=$SourceRef"
  Write-Host "Target: $target"
  Write-Host 'Use -Apply to clone and import tracked SCC380 files into the BONDS root.'
  return
}
New-Item -ItemType Directory -Force -Path $stageParent | Out-Null
try {
  & git -c core.symlinks=false clone --depth 1 --single-branch --branch $SourceRef -- $SourceUrl $stage
  if ($LASTEXITCODE -ne 0) { throw 'SCC380 clone failed.' }
  $sha = (& git -C $stage rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40}$') { throw 'Cannot pin source commit.' }
  $files = @(& git -C $stage ls-files --cached --full-name)
  if ($LASTEXITCODE -ne 0 -or $files.Count -eq 0) { throw 'Source inventory failed.' }
  foreach ($file in $files) {
    if ([string]::IsNullOrWhiteSpace($file) -or [IO.Path]::IsPathRooted($file) -or $file -match '(^|/)\.\.(/|$)') {
      throw "Unsafe tracked path: $file"
    }
    $src = Join-Path $stage ($file.Replace('/', [IO.Path]::DirectorySeparatorChar))
    if (Is-Excluded $file) { $skip.Add($file); continue }
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw "Tracked source file missing: $file" }
    $item = Get-Item -LiteralPath $src -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Symlink/reparse point rejected: $file" }
    $copied.Add([pscustomobject]@{ path=$file; sha256=(Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant() })
  }
  if ($copied.Count -eq 0) { throw 'No eligible source files.' }
  # Preflight complete: no target files have been changed before this point.
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($entry in $copied) {
    $from = Join-Path $stage ($entry.path.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $to = Join-Path $target ($entry.path.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $parent = Split-Path $to -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    Copy-Item -LiteralPath $from -Destination $to -ErrorAction Stop
    if ((Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
      throw "Copy integrity mismatch: $($entry.path)"
    }
  }
  $manifest = [ordered]@{
    project = 'BONDS Company Programs'
    source_repository = $SourceUrl
    source_ref = $SourceRef
    source_sha = $sha
    target = 'integrations/makkin/source'
    imported_utc = [DateTime]::UtcNow.ToString('o')
    imported_file_count = $copied.Count
    skipped_sensitive_file_count = $skip.Count
    skipped_sensitive_paths = @($skip)
    files = @($copied)
    status = 'SOURCE_IMPORTED_ONLY_NOT_INTEGRATED_OR_DEPLOYED'
  }
  $json = ConvertTo-Json -InputObject $manifest -Depth 6
  [IO.File]::WriteAllText($manifestPath, $json, [Text.UTF8Encoding]::new($false))
  Write-Host "SOURCE IMPORTED: $($copied.Count) files; skipped $($skip.Count); SHA $sha"
  Write-Host "BONDS-local target: $target"
  Write-Host 'No runtime integration, database migration or production deployment performed.'
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  # Keep only the owned, explicit import area under the BONDS root.
  if (Test-Path -LiteralPath $stageParent) {
    $others = @(Get-ChildItem -LiteralPath $stageParent -Force)
    if ($others.Count -eq 0) { Remove-Item -LiteralPath $stageParent }
  }
}
