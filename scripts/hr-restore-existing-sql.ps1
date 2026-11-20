#Requires -Version 5.1
<#
Restore ONLY the already-exported Supabase CLI schema/data SQL files.
No remote connection, no new dump, no database creation, no destructive reset.
Prerequisite: an existing EMPTY, disposable local Postgres database with
Supabase-required schemas, roles and extensions available.
Invoke from the repository root:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\hr-restore-existing-sql.ps1 -DatabaseName bonds_hr_restore_test
Do not place backup SQL files in Git.
#>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z][a-zA-Z0-9_]*$')][string]$DatabaseName)
$ErrorActionPreference='Stop'
function StopNow([string]$reason) { throw ("BLOCKED: " + $reason) }
$root=Split-Path -Parent $PSScriptRoot
$schema=Join-Path $root 'hr-backup-preflight\schema-20261118.sql'
$data=Join-Path $root 'hr-backup-preflight\data-20261118.sql'
$psql='C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { StopNow 'PostgreSQL 17 psql.exe missing' }
foreach ($item in @(@($schema,'863F76F10BFD322A63D3D6FF03434191347316D39BC50C87A928051CA31D5050'),@($data,'F6074792A04765859C937F27D1DE06B335C2E3E3A78FA8C6E575F65B5BD37F5B'))) {
 if (-not (Test-Path -LiteralPath $item[0] -PathType Leaf)) { StopNow ('Missing existing backup: '+$item[0]) }
 if ((Get-FileHash -LiteralPath $item[0] -Algorithm SHA256).Hash -ne $item[1]) { StopNow ('SHA256 mismatch: '+$item[0]) }
}
if (@('postgres','template0','template1') -contains $DatabaseName) { StopNow 'System database forbidden' }
$vars=@('PGHOST','PGPORT','PGSERVICE','PGSERVICEFILE','PGDATABASE')
foreach($v in $vars) { if ([Environment]::GetEnvironmentVariable($v)) { StopNow ('Unset '+$v+' before restore to avoid unintended connections') } }
$env:PGCONNECT_TIMEOUT='5'
try {
 $base=@('-X','-w','-h','127.0.0.1','-p','5432','-U','postgres','-d',$DatabaseName,'-v','ON_ERROR_STOP=1','-A','-t')
 $identity=& $psql @base -c 'select inet_server_addr()::text || ''|'' || current_database() || ''|'' || current_user;'
 if ($LASTEXITCODE -ne 0 -or -not $identity) { StopNow 'Local connection failed. Configure local PostgreSQL auth, not production credentials' }
 if (($identity | Select-Object -Last 1).Trim() -ne ('127.0.0.1|'+$DatabaseName+'|postgres')) { StopNow 'Not the intended loopback database' }
 $existing=& $psql @base -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f');"
 if ($LASTEXITCODE -ne 0 -or [string]($existing | Select-Object -Last 1).Trim() -ne '0') { StopNow 'Target public schema is not empty; no changes applied' }
 Write-Host 'Restoring existing schema SQL into isolated local database...'
 & $psql @base --single-transaction -f $schema
 if ($LASTEXITCODE -ne 0) { StopNow 'Schema restore failed; transaction rolled back' }
 Write-Host 'Restoring existing data SQL with foreign keys enabled...'
 & $psql @base --single-transaction -f $data
 if ($LASTEXITCODE -ne 0) { StopNow 'Data restore failed; transaction rolled back. Existing schema remains. Do not disable foreign keys automatically' }
 $tables=& $psql @base -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');"
 if ($LASTEXITCODE -ne 0 -or [int]($tables | Select-Object -Last 1).Trim() -le 0) { StopNow 'No restored public tables' }
 Write-Host ('STATUS: PASS - LOCAL_SQL_RESTORE; PUBLIC_TABLES: '+($tables | Select-Object -Last 1).Trim())
} finally { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue }
