#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ExpectedRepoName = 'bonds-global-web'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gitRoot = (& git -C $root rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath([string]$gitRoot).TrimEnd([char[]]@('/','\')) -ne $root.TrimEnd([char[]]@('/','\'))) {
    throw 'FAIL: script must run in the BONDS Git root'
}
if ((Split-Path -Leaf $root) -ne $ExpectedRepoName) { throw 'FAIL: unexpected repository root' }
$matrixPath = Join-Path $root 'docs/makkin-route-transfer-matrix.json'
$sourcePath = Join-Path $root 'docs/makkin-source-inventory-20261115.json'
$fieldPath = Join-Path $root 'docs/makkin-database-field-parity.json'
foreach ($p in @($matrixPath,$sourcePath,$fieldPath)) {
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "FAIL: missing source inventory: $p" }
}
$source = Get-Content -LiteralPath $sourcePath -Raw | ConvertFrom-Json
$routes = Get-Content -LiteralPath $matrixPath -Raw | ConvertFrom-Json
$fields = Get-Content -LiteralPath $fieldPath -Raw | ConvertFrom-Json
if ($source.summary.navigationEntries -ne 74 -or $source.summary.dataModels -ne 108 -or
    $source.summary.modelFields -ne 1966 -or $source.summary.apiModules -ne 33) {
    throw 'FAIL: source inventory changed without review'
}
if (@($routes.routes).Count -ne 74 -or @($fields.models).Count -ne 108) {
    throw 'FAIL: parity inventory does not match the source'
}
$unverifiedRoutes = @($routes.routes | Where-Object {
    $_.transferStatus -ne 'VERIFIED' -or $_.fieldAndWorkflowParity -ne 'PASS' -or
    [string]::IsNullOrWhiteSpace([string]$_.bondsRoute)
}).Count
$unverifiedFields = 0
foreach ($model in $fields.models) {
    foreach ($field in $model.fields) {
        if ($field.status -ne 'VERIFIED' -or [string]::IsNullOrWhiteSpace([string]$field.evidence) -or
            [string]::IsNullOrWhiteSpace([string]$field.bondsTable) -or
            [string]::IsNullOrWhiteSpace([string]$field.bondsField)) { $unverifiedFields++ }
    }
}
if ($unverifiedFields -gt 1966) { throw 'FAIL: field count exceeds source inventory' }
$tests = @(
  'tests/company-programs/recovered-route-gate.test.js',
  'tests/company-programs/makkin-bridge-policy.test.js',
  'tests/company-programs/makkin-mapping-proof.test.js',
  'tests/company-programs/company-programs-endpoint.test.js',
  'tests/company-programs/real-workspace-entitlements.test.js',
  'tests/company-programs/tenant-read-client-contract.test.js',
  'tests/company-programs/staging-task-workflow-contract.test.js'
)
foreach ($testFile in $tests) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $testFile) -PathType Leaf)) {
        throw "FAIL: missing unit test: $testFile"
    }
}
Push-Location $root
try {
    & node ./node_modules/jest/bin/jest.js --runInBand @tests
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: scoped company-program unit tests' }
    # The strict parity checker intentionally exits 1 until operational evidence exists.
    # Capture its result and fail if it accidentally reports completed migration.
    $raw = & node scripts/verify-company-programs-parity.js
    $parityExit = $LASTEXITCODE
    if ($parityExit -ne 1) { throw "FAIL: expected incomplete parity gate, got exit $parityExit" }
    $result = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
    if ($result.status -ne 'FAIL' -or $result.source.routes -ne 74 -or
        $result.source.fields -ne 1966 -or $result.errors -lt 1) {
        throw 'FAIL: strict parity gate returned unexpected evidence'
    }
    [pscustomobject]@{
        status = 'PARTIAL'
        focusedTests = 'PASS'
        fullOperationalParity = 'FAIL'
        sourceRoutes = 74
        unverifiedRoutes = $unverifiedRoutes
        sourceFields = 1966
        unverifiedFields = $unverifiedFields
        releaseApproved = $false
        productionChanged = $false
        gitSha = ((& git rev-parse HEAD) -join '').Trim()
    } | ConvertTo-Json -Depth 5
}
finally {
    Pop-Location
}
