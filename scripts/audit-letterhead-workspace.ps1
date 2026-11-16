# Read-only Bonds correspondence/workspace/button audit. PowerShell 5.1.
# Run from any directory with: & ".\\scripts\\audit-letterhead-workspace.ps1"
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$expectedRemote = 'alzahrani6020/bonds-global-web'
$problems = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
function Check([string]$name, [bool]$ok, [string]$detail) {
  if ($ok) { Write-Host ("PASS | " + $name) }
  else { Write-Host ("FAIL | " + $name + " | " + $detail); $script:problems.Add($name) }
}
function ContainsText([string]$path, [string]$text) {
  return ((Get-Content -LiteralPath (Join-Path $root $path) -Raw).Contains($text))
}
Push-Location $root
try {
  $gitRoot = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0) { throw 'STOP: not a Git repository' }
  $resolved = (Resolve-Path $gitRoot).Path
  if ($resolved -ne $root) { throw "STOP: unexpected Git root: $resolved" }
  $remote = (& git remote get-url origin 2>$null)
  if ($LASTEXITCODE -ne 0 -or $remote -notlike "*$expectedRemote*") { throw 'STOP: unexpected repository origin' }
  Write-Host ("ROOT=" + $root)
  Write-Host ("BRANCH=" + (& git branch --show-current))
  Write-Host ("SHA=" + (& git rev-parse HEAD))
  $changed = @(& git status --porcelain)
  if ($changed.Count -gt 0) {
    Write-Host 'LOCAL_CHANGES_PRESENT (no files modified by audit):'
    $changed | ForEach-Object { Write-Host $_ }
  }
  $html = 'letterhead.html'
  $ui = 'components/letterhead-correspondence.js'
  $api = 'lib/api/correspondence.js'
  $platform = 'api/platform.js'
  $config = 'vercel.json'
  foreach ($file in @($html,$ui,$api,$platform,$config)) {
    if (-not (Test-Path (Join-Path $root $file))) { throw "STOP: missing required file $file" }
  }

  Check 'Route rewrite to platform' (ContainsText $config '"source": "/api/correspondence"') 'Missing /api/correspondence rewrite'
  Check 'Platform imports correspondence handler' (ContainsText $platform "require('../lib/api/correspondence')") 'Missing correspondence module'
  Check 'UI uses authenticated correspondence API' (ContainsText $ui "fetch('/api/correspondence?'") 'No correspondence fetch'
  Check 'Server reads company memberships' (ContainsText $api "from('company_members')") 'No membership lookup'
  Check 'Server validates workspace on create' (ContainsText $api 'validateWorkspaceContext(sb, body.workspace_context') 'No create validation'
  Check 'Server validates workspace on save' (ContainsText $api 'async function saveVersion(') 'No saveVersion'
  Check 'Workspace company ID checked against membership' (ContainsText $api 'membershipCompanyIds.has(ctx.company_id)') 'No membership guard'
  Check 'Workspace project ID checked on server' (ContainsText $api "if (ctx.project_id)") 'No project validation'
  Check 'Workspace attached to new correspondence' (ContainsText $ui 'workspace_context: currentWorkspaceContext()') 'No workspace context on create/save'
  Check 'Inbox filters by workspace' (ContainsText $ui '...workspaceQuery()') 'No workspace query'
  Check 'Official PDF requires archived artifact hash' (ContainsText $ui 'if (!state.document?.artifact_hash)') 'No immutable artifact check'
  Check 'Official PDF requests signed URL' (ContainsText $ui "api('artifact-download-url'") 'No archive download API'

  $htmlText = Get-Content -LiteralPath (Join-Path $root $html) -Raw
  $exportMatches = [regex]::Matches($htmlText, '<button[^>]*onclick="exportPDF\\(\\)"[^>]*>')
  Write-Host ("PDF_EXPORT_CONTROLS=" + $exportMatches.Count)
  Check 'PDF export action present' ($exportMatches.Count -ge 1) 'No exportPDF button found'
  $printMatches = [regex]::Matches($htmlText, '<button[^>]*onclick="exportPDF\\(\\)"[^>]*class="[^"]*btn-print')
  if ($printMatches.Count -gt 0) {
    Write-Host 'FAIL | Print button invokes exportPDF rather than a print-only action'
    $problems.Add('Print action wrongly wired')
  } else {
    Write-Host 'PASS | No print button directly bound to exportPDF'
  }
  $client = Get-Content -LiteralPath (Join-Path $root $ui) -Raw
  $server = Get-Content -LiteralPath (Join-Path $root $api) -Raw
  if ($client.Contains("ctx.workspace = 'correspondence'") -and $client.Contains("return ['service','workspace'")) {
    Write-Host 'WARN | Default workspace context may mask absent originating workspace'
    $warnings.Add('Default workspace hides absence of real workspace')
  }
  if ($server.Contains('derivedCompanyId = derivedCompanyId || data.company_id || null;') -and
      -not $server.Contains('Workspace company/project mismatch')) {
    Write-Host 'WARN | No explicit cross-check found between supplied company_id and resolved project company_id'
    $warnings.Add('Company/project consistency needs a controlled authorization test')
  }
  & node --check (Join-Path $root $ui)
  Check 'UI JS syntax' ($LASTEXITCODE -eq 0) 'node --check failed'
  & node --check (Join-Path $root $api)
  Check 'API JS syntax' ($LASTEXITCODE -eq 0) 'node --check failed'
  Write-Host ("AUDIT_FAIL_COUNT=" + $problems.Count)
  Write-Host ("AUDIT_WARNING_COUNT=" + $warnings.Count)
  Write-Host 'LIVE_BROWSER_SAVE_PRINT=NOT_TESTED'
  Write-Host 'SERVER_TENANT_ISOLATION=NOT_TESTED'
  Write-Host 'DOCUMENT_ARTIFACT_HASH=NOT_VERIFIED'
  if ($problems.Count -gt 0) { Write-Host 'STATUS=FAIL_STATIC_AUDIT'; exit 1 }
  Write-Host 'STATUS=PASS_STATIC_ONLY'
} finally {
  Pop-Location
}
