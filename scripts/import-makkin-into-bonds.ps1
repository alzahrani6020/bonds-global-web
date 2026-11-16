# Import a vetted SCC380 source snapshot exclusively under the BONDS Git root.
# This is a source snapshot, NOT functional migration or authorization integration.
# Windows PowerShell 5.1 / PowerShell 7. Default is read-only dry-run.
[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$SourceRef = 'main',
  [string]$SourceUrl = 'https://github.com/alzahrani6020/scc380.git'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stageParent = Join-Path $root '.makkin-import'
$importBase = Join-Path $root 'integrations\makkin'
$target = Join-Path $importBase 'source'
$manifestPath = Join-Path $importBase 'import-manifest.json'
$run = [guid]::NewGuid().ToString('N')
$stage = Join-Path $stageParent ('clone-' + $run)
$candidate = Join-Path $stageParent ('candidate-' + $run)
$temporaryManifest = Join-Path $stageParent ('manifest-' + $run + '.json')
$skip = New-Object 'System.Collections.Generic.List[string]'
$copied = New-Object 'System.Collections.Generic.List[object]'
$committed = $false

function Assert-DirectoryNotLink([string]$path) {
  $full = [IO.Path]::GetFullPath($path)
  $current = $full
  while ($current -and (Test-Path -LiteralPath $current)) {
    $item = Get-Item -LiteralPath $current -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Reparse point in import path: $current"
    }
    $parent = Split-Path -Path $current -Parent
    if (-not $parent -or $parent -eq $current) { break }
    $current = $parent
  }
}
function Is-Excluded([string]$relative) {
  $s = $relative.Replace('\','/')
  foreach ($part in $s.Split('/')) {
    if ($part -match '^(?i:\.env(?:\..*)?|\.git|node_modules|\.next|dist|build|coverage|\.vercel|\.cache|__pycache__|\.ssh|secrets?)$') { return $true }
  }
  if ($s -match '(?i)(^|/)(?:id_rsa|id_ed25519|credentials(?:\.[^/]*)?|service-account(?:\.[^/]*)?|\.npmrc|\.pypirc|\.netrc|\.dockerconfigjson)(?:$|\.)') { return $true }
  if ($s -match '(?i)\.(?:pem|p12|pfx|key|keystore|jks|asc|kdbx|sqlite|sqlite3|db|dump|bak|backup)$') { return $true }
  return $false
}
function Assert-NoSecret([string]$path, [string]$relative) {
  $size = (Get-Item -LiteralPath $path -Force -ErrorAction Stop).Length
  if ($size -gt 10485760) { throw "Manual review required: file over 10 MB: $relative" }
  $bytes = [IO.File]::ReadAllBytes($path)
  if ([Array]::IndexOf($bytes,[byte]0) -ge 0) { return } # Binary is not scanned, only hashed.
  $content = [Text.Encoding]::UTF8.GetString($bytes)
  # Audit CI fixtures in memory without modifying imported source bytes.
  # Only dynamically generated test passwords and explicit CI-only JWT fixtures
  # qualify. Every other credential signature still fails closed.
  if ($relative -match '^\.github/workflows/[^/]+\.ya?ml$') {
    $content = [regex]::Replace($content,
      '(?m)SMOKE_PASSWORD=["' + "'" + '][^"\r\n]*\$\(openssl rand -hex 12\)[^"\r\n]*["' + "'" + ']',
      'SMOKE_PASSWORD=runtime-generated')
    $content = [regex]::Replace($content,
      '(?m)SMOKE_PASSWORD=["' + "'" + ']?\$SMOKE_PASSWORD["' + "'" + ']?',
      'SMOKE_PASSWORD=runtime-forwarded')
    $content = [regex]::Replace($content,
      '(?m)JWT_SECRET=["' + "'" + '][a-zA-Z0-9-]+-ci-only-not-production-secret["' + "'" + ']',
      'JWT_SECRET=audited-ci-fixture')
  }
  # Replace only audited literal placeholders used by SCC380 test fixtures.
  # This affects scanner input, never the source bytes written or hashed.
  if ($relative -ceq 'apps/api/test/auth-rate-limit-guard.spec.ts') {
    $content = $content.Replace("'test-only-placeholder'", 'fixture-token')
    $content = $content.Replace("'correct-only-for-test'", 'fixture-password')
  }
  $signals = @(
    '-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    '(?i)\b(?:ghp|gho|ghu|ghs|ghr)_[a-z0-9]{30,}\b',
    '(?i)\bgithub_pat_[a-z0-9_]{30,}\b',
    '(?i)\b(?:sk_live|rk_live)_[a-z0-9]{16,}\b',
    '(?i)\bAKIA[0-9A-Z]{16}\b',
    '(?i)(?:password|api[_-]?key|client[_-]?secret|private[_-]?key|access[_-]?token)\s*[:=]\s*["''][^"''\r\n]{12,}["'']'
  )
  for ($signalIndex = 0; $signalIndex -lt $signals.Count; $signalIndex++) {
    if ([regex]::IsMatch($content,$signals[$signalIndex])) {
      # Signal index is diagnostic metadata; never print matched secret content.
      throw "Possible credential signature $signalIndex in tracked source file (no value shown): $relative"
    }
  }
  if ($content.StartsWith('version https://git-lfs.github.com/spec/v1')) {
    throw "Git LFS pointer is not a real source file: $relative"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { throw 'BONDS repository root is missing.' }
$actualRoot = (& git -C $root rev-parse --show-toplevel 2>&1)
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath([string]$actualRoot).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($root).TrimEnd('\','/')) {
  throw 'Script must stay in the original BONDS Git root.'
}
if ($SourceUrl -cne 'https://github.com/alzahrani6020/scc380.git') { throw 'Source URL is pinned.' }
if ($SourceRef -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,120}$' -or $SourceRef.Contains('..') -or $SourceRef.Contains('@{')) {
  throw 'Invalid source ref.'
}
foreach ($path in @($root, $stageParent, $importBase, $target, $manifestPath)) { Assert-DirectoryNotLink $path }
if ((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath $manifestPath)) {
  throw 'Existing import detected: refusing to overwrite or merge an earlier snapshot.'
}
if (-not $Apply) {
  Write-Host "DRY RUN: BONDS root $root"
  Write-Host "Pinned source: $SourceUrl ref=$SourceRef"
  Write-Host "Target: $target"
  Write-Host 'No files changed. -Apply performs a preflight and atomic publication.'
  return
}

New-Item -ItemType Directory -Path $stageParent -Force | Out-Null
try {
  & git -c core.symlinks=false -c core.hooksPath=NUL clone --depth 1 --single-branch --branch $SourceRef -- $SourceUrl $stage
  if ($LASTEXITCODE -ne 0) { throw 'Source clone failed.' }
  $sha = (& git -C $stage rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40}$') { throw 'Source HEAD verification failed.' }
  $index = @(& git -C $stage -c core.quotePath=false ls-files --stage)
  if ($LASTEXITCODE -ne 0 -or $index.Count -eq 0) { throw 'No tracked source files.' }
  $paths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  New-Item -ItemType Directory -Path $candidate | Out-Null

  foreach ($line in $index) {
    if ($line -notmatch '^([0-7]{6}) [0-9a-f]{40} [0-3]\t(.+)$') { throw 'Unexpected Git index record.' }
    $mode = $Matches[1]
    $file = $Matches[2]
    if ($mode -ne '100644' -and $mode -ne '100755') { throw "Non-regular tracked Git file rejected: $file" }
    if (-not $paths.Add($file)) { throw "Windows case-insensitive filename collision: $file" }
    if ([string]::IsNullOrWhiteSpace($file) -or [IO.Path]::IsPathRooted($file) -or
        $file -match '(^|/)\.\.?(/|$)' -or $file.Contains('\') -or $file.Contains(':')) {
      throw "Unsafe tracked path: $file"
    }
    $src = Join-Path $stage ($file.Replace('/',[IO.Path]::DirectorySeparatorChar))
    if (Is-Excluded $file) { $skip.Add($file); continue }
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw "Tracked file unavailable: $file" }
    Assert-DirectoryNotLink $src
    Assert-NoSecret $src $file
    $hash = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant()
    $to = Join-Path $candidate ($file.Replace('/',[IO.Path]::DirectorySeparatorChar))
    $parent = Split-Path -Path $to -Parent
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $to -ErrorAction Stop
    if ((Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) {
      throw "SHA256 integrity mismatch: $file"
    }
    $copied.Add([pscustomobject]@{ path=$file; sha256=$hash })
  }
  if ($copied.Count -eq 0) { throw 'No eligible source code.' }
  $manifest = [ordered]@{
    project='BONDS Company Programs'
    source_repository=$SourceUrl
    source_ref=$SourceRef
    source_sha=$sha
    target='integrations/makkin/source'
    imported_utc=[DateTime]::UtcNow.ToString('o')
    imported_file_count=$copied.Count
    skipped_sensitive_file_count=$skip.Count
    skipped_sensitive_paths=@($skip)
    files=@($copied)
    status='SOURCE_IMPORTED_ONLY_NOT_INTEGRATED_OR_DEPLOYED'
  }
  [IO.File]::WriteAllText($temporaryManifest,(ConvertTo-Json -InputObject $manifest -Depth 6),([Text.UTF8Encoding]::new($false)))
  if (-not (Test-Path -LiteralPath $importBase)) { New-Item -ItemType Directory -Path $importBase -Force | Out-Null }
  Assert-DirectoryNotLink $importBase
  if ((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath $manifestPath)) { throw 'Import target appeared during preflight.' }
  # Only publish complete, hashed source; incomplete candidate remains ignored.
  Move-Item -LiteralPath $candidate -Destination $target -ErrorAction Stop
  try {
    Move-Item -LiteralPath $temporaryManifest -Destination $manifestPath -ErrorAction Stop
    $committed = $true
  } catch {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    throw
  }
  Write-Host "IMPORTED SNAPSHOT: $($copied.Count) files, $($skip.Count) excluded; source SHA $sha"
  Write-Host 'Still not an operational BONDS integration. No deployment or database writes.'
} finally {
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  if (Test-Path -LiteralPath $candidate) { Remove-Item -LiteralPath $candidate -Recurse -Force }
  if (Test-Path -LiteralPath $temporaryManifest) { Remove-Item -LiteralPath $temporaryManifest -Force }
}
