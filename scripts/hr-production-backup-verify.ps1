#Requires -Version 5.1
<#
  Zero-fee production backup and local restore preflight.
  Prerequisites: PostgreSQL 17 pg_dump/pg_restore/psql, two local libpq
  service definitions (see README or pg_service.conf), with credentials
  stored outside Git. Never paste passwords or connection strings here.
  service=bonds-production: read-only production connection with pg_dump access
  service=bonds-restore-local: EMPTY disposable local PostgreSQL database
  NEVER run the restore service against production or any remote environment.
  Example:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\hr-production-backup-verify.ps1 -BackupPath C:\Backups\bonds-prod-20261118.dump
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupPath
)
$ErrorActionPreference = 'Stop'
function Fail([string]$reason) { throw ("BLOCKED: " + $reason) }
foreach ($tool in @('psql', 'pg_dump', 'pg_restore')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Fail "$tool missing: install the PostgreSQL 17 client tools before any production change"
  }
}
$dest = [System.IO.Path]::GetFullPath($BackupPath)
$parent = [System.IO.Path]::GetDirectoryName($dest)
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
  Fail "Backup directory must already exist and be accessible"
}
if (Test-Path -LiteralPath $dest) { Fail "Refusing to overwrite an existing backup" }
$destExt = [System.IO.Path]::GetExtension($dest)
if ($destExt -ne '.dump') { Fail "Backup filename must end with .dump" }
# Services are configured outside the repository. Credentials are not arguments.
$sourceService = 'service=bonds-production'
$restoreService = 'service=bonds-restore-local'
$source = & psql -X -A -t -v ON_ERROR_STOP=1 -d $sourceService -c "select current_database()"
if ($LASTEXITCODE -ne 0 -or -not $source) { Fail "Cannot read production service" }
$target = & psql -X -A -t -v ON_ERROR_STOP=1 -d $restoreService -c "select coalesce(inet_server_addr()::text,'UNIX') || '|' || current_database()"
if ($LASTEXITCODE -ne 0 -or -not $target) { Fail "Cannot inspect local restore service" }
$parts = ($target | Select-Object -Last 1).Trim().Split('|')
if ($parts.Length -ne 2 -or @('127.0.0.1','::1') -notcontains $parts[0]) {
  Fail "Restore server is not PostgreSQL on loopback"
}
if (@('postgres','template0','template1') -contains $parts[1]) {
  Fail "Refusing to restore into a PostgreSQL system/default database"
}
$count = & psql -X -A -t -v ON_ERROR_STOP=1 -d $restoreService -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and c.relkind in ('r','p','v','m','f')"
if ($LASTEXITCODE -ne 0 -or [string]($count | Select-Object -Last 1).Trim() -ne '0') {
  Fail "Restore database is not empty; do not modify it"
}
Write-Host "Creating a protected local backup file; do not upload it to GitHub or CI artifacts."
& pg_dump --dbname=$sourceService --format=custom --no-owner --no-acl --file=$dest
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dest) -or (Get-Item -LiteralPath $dest).Length -le 1024) {
  Fail "pg_dump did not create a valid-sized archive; production unchanged"
}
$entries = @(& pg_restore --list $dest)
if ($LASTEXITCODE -ne 0 -or $entries.Count -lt 5) { Fail "Archive TOC failed validation" }
Write-Host "Backup archived; verifying restoration on empty loopback database..."
& pg_restore --exit-on-error --no-owner --no-acl --dbname=$restoreService $dest
if ($LASTEXITCODE -ne 0) { Fail "Restore failed: backup is NOT yet proven recoverable" }
$tables = & psql -X -A -t -v ON_ERROR_STOP=1 -d $restoreService -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')"
if ($LASTEXITCODE -ne 0 -or [int]($tables | Select-Object -Last 1).Trim() -lt 1) {
  Fail "Restored database has no public tables; acceptance rejected"
}
$hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
Write-Host ("PASS: backup + isolated restore verified. Archive bytes: " + (Get-Item -LiteralPath $dest).Length)
Write-Host ("Archive SHA256: " + $hash)
Write-Host "KEEP THE DUMP PRIVATE. This does not apply HR migrations or deploy production."
