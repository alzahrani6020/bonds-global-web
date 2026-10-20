param(
    [switch]$Activate,
    [int]$HealthTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $env:ProgramData "BondsTokenRuntime"
$runtimeDir = Join-Path $stateDir "runtime"
$dataDir = Join-Path $stateDir "data"
New-Item -ItemType Directory -Force -Path $runtimeDir,$dataDir | Out-Null

$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_PYTHON_EXE", "Machine")
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
}
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [string](Get-Command python -ErrorAction Stop).Source
}

$probe = & $pythonExe -c "import win32serviceutil; print('ok')" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "pywin32 is unavailable for the selected Python. Install pywin32 before activating the service."
}

$db = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_DB", "Machine")
$secret = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_ADMIN_SECRET_FILE", "Machine")
$build = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", "Machine")
$port = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_PORT", "Machine")

if ([string]::IsNullOrWhiteSpace($db)) {
    $db = Join-Path $dataDir "tokens.db"
}
if ([string]::IsNullOrWhiteSpace($secret) -or -not (Test-Path -LiteralPath $secret -PathType Leaf)) {
    throw "Machine-level BONDS_TOKEN_ADMIN_SECRET_FILE is missing or invalid. Refusing to generate or rotate the admin secret."
}
if ([string]::IsNullOrWhiteSpace($build)) {
    throw "Machine-level BONDS_TOKEN_BUILD_COMMIT is required."
}
if ([string]::IsNullOrWhiteSpace($port)) {
    $port = "8771"
}
if ($port -ne "8771") {
    throw "Bonds Token Runtime contract requires port 8771."
}

$pkgSource = Join-Path $sourceRoot "bonds_security"
$pkgDest = Join-Path $runtimeDir "bonds_security"
New-Item -ItemType Directory -Force -Path $pkgDest | Out-Null
foreach ($name in @("__init__.py","server.py","token_engine.py")) {
    Copy-Item -LiteralPath (Join-Path $pkgSource $name) -Destination (Join-Path $pkgDest $name) -Force
}
Copy-Item -LiteralPath (Join-Path $sourceRoot "contract.json") -Destination (Join-Path $runtimeDir "contract.json") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "token_service.py") -Destination (Join-Path $runtimeDir "token_service.py") -Force

$serviceHost = Join-Path $runtimeDir "token_service.py"
$existing = Get-Service -Name "BondsTokenRuntimeService" -ErrorAction SilentlyContinue
if ($existing) {
    & $pythonExe $serviceHost --startup auto update
} else {
    & $pythonExe $serviceHost --startup auto install
}
if ($LASTEXITCODE -ne 0) {
    throw "Failed to install/update BondsTokenRuntimeService."
}

& sc.exe failure BondsTokenRuntimeService reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
& sc.exe failureflag BondsTokenRuntimeService 1 | Out-Null
& sc.exe config BondsTokenRuntimeService start= auto | Out-Null

$serviceEnvironment = @(
    "BONDS_TOKEN_DB=$db",
    "BONDS_TOKEN_ADMIN_SECRET_FILE=$secret",
    "BONDS_TOKEN_BUILD_COMMIT=$build",
    "BONDS_TOKEN_PORT=8771",
    "BONDS_TOKEN_RUNTIME_ROOT=$runtimeDir",
    "BONDS_TOKEN_STATE_DIR=$stateDir",
    "BONDS_TOKEN_PYTHON_EXE=$pythonExe"
)
$serviceRegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\BondsTokenRuntimeService"
New-ItemProperty -Path $serviceRegistryPath -Name "Environment" -PropertyType MultiString -Value $serviceEnvironment -Force | Out-Null

function Test-Health {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:8771/health" -TimeoutSec 5
        return ($r.status -eq "ok" -and $r.service -eq "bonds-token-service" -and [int]$r.service_token_ttl_seconds -eq 3600)
    }
    catch {
        return $false
    }
}

if (-not $Activate) {
    Write-Host "Prepared BondsTokenRuntimeService. Existing port 8771 process was not changed."
    Write-Host "Run again with -Activate for health-checked cutover."
    exit 0
}

$listener = Get-NetTCPConnection -LocalPort 8771 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$legacyPid = if ($listener) { [int]$listener.OwningProcess } else { 0 }
$legacyWasBondsRuntime = $false

if ($legacyPid -gt 0) {
    $legacyProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $legacyPid" -ErrorAction SilentlyContinue
    $legacyCommandLine = [string]$legacyProcess.CommandLine
    $legacyWasBondsRuntime =
        $legacyCommandLine -match "bonds_security\.server" -or
        $legacyCommandLine -match [Regex]::Escape($stateDir)

    if (-not $legacyWasBondsRuntime) {
        throw "Port 8771 is owned by an unexpected process. Refusing to stop PID $legacyPid."
    }
}

try {
    if ($legacyPid -gt 0) {
        Stop-Process -Id $legacyPid -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
    }

    Start-Service -Name "BondsTokenRuntimeService"

    $deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        if (Test-Health) {
            $healthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if (-not $healthy) {
        throw "BondsTokenRuntimeService did not become healthy before timeout."
    }

    Write-Host "BondsTokenRuntimeService is healthy and configured for Windows boot."
}
catch {
    Stop-Service -Name "BondsTokenRuntimeService" -Force -ErrorAction SilentlyContinue

    if ($legacyPid -gt 0 -and $legacyWasBondsRuntime) {
        try {
            Start-Process -FilePath $pythonExe -ArgumentList @("-m", "bonds_security.server") -WorkingDirectory $runtimeDir -WindowStyle Hidden | Out-Null

            $rollbackDeadline = (Get-Date).AddSeconds(20)
            $rollbackHealthy = $false
            while ((Get-Date) -lt $rollbackDeadline) {
                if (Test-Health) {
                    $rollbackHealthy = $true
                    break
                }
                Start-Sleep -Seconds 1
            }

            if (-not $rollbackHealthy) {
                throw "Legacy runtime restart did not become healthy."
            }
        }
        catch {
            throw "Token runtime service cutover failed and automatic legacy rollback also failed. $($_.Exception.Message)"
        }

        throw "Token runtime service cutover failed and the legacy runtime was restored. $($_.Exception.Message)"
    }

    throw "Token runtime service cutover failed. No legacy Bonds runtime was active before cutover. $($_.Exception.Message)"
}
