$ErrorActionPreference = "Stop"

$repo = "C:\Users\vip\bonds-global-web"
Set-Location $repo

$reg = "HKLM:\SYSTEM\CurrentControlSet\Services\BondsTokenRuntimeService"
$entries = (Get-ItemProperty -Path $reg -Name Environment -ErrorAction Stop).Environment

$cfg = @{}
foreach ($entry in @($entries)) {
    $p = $entry -split "=", 2
    if ($p.Count -eq 2) {
        $cfg[$p[0]] = $p[1]
    }
}

foreach ($required in @(
    "BONDS_TOKEN_CHANNEL_SECRET_FILE",
    "BONDS_TOKEN_BROKER_SECRET_FILE",
    "BONDS_TOKEN_BUILD_COMMIT"
)) {
    if ([string]::IsNullOrWhiteSpace([string]$cfg[$required])) {
        throw "Missing Token Runtime service setting: $required"
    }
}

$channelFile = [string]$cfg["BONDS_TOKEN_CHANNEL_SECRET_FILE"]
$brokerFile = [string]$cfg["BONDS_TOKEN_BROKER_SECRET_FILE"]
$buildCommit = [string]$cfg["BONDS_TOKEN_BUILD_COMMIT"]

$env:BONDS_TOKEN_ALLOW_LOCAL_HTTP = "1"
$env:BONDS_TOKEN_INTROSPECTION_URL = "http://127.0.0.1:8771/introspect"
$env:BONDS_TOKEN_RUNTIME_HEALTH_URL = "http://127.0.0.1:8771/health"
$env:BONDS_TOKEN_BROKER_URL = "http://127.0.0.1:8771/broker/issue"
$env:BONDS_TOKEN_CHANNEL_SECRET = [IO.File]::ReadAllText($channelFile).Trim()
$env:BONDS_TOKEN_BROKER_SECRET = [IO.File]::ReadAllText($brokerFile).Trim()
$env:BONDS_TOKEN_EXPECTED_BUILD_COMMIT = $buildCommit.Trim().ToLowerInvariant()
$env:PORT = "3005"

if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_CHANNEL_SECRET)) {
    throw "Token Runtime channel secret is empty."
}
if ([string]::IsNullOrWhiteSpace($env:BONDS_TOKEN_BROKER_SECRET)) {
    throw "Token Runtime broker secret is empty."
}
if ($env:BONDS_TOKEN_EXPECTED_BUILD_COMMIT -cnotmatch '^[0-9a-f]{40}$') {
    throw "Token Runtime build identity is invalid."
}

$listener = Get-NetTCPConnection -LocalPort 3005 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and [string]$process.CommandLine -match 'scripts[\\/]dev-server\.js') {
        exit 0
    }
    throw "Port 3005 is already owned by another process."
}

& "C:\Program Files\nodejs\node.exe" "$repo\scripts\dev-server.js"
exit $LASTEXITCODE
