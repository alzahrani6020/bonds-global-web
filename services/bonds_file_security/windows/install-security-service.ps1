param(
    [Parameter(Mandatory = $true)]
    [string]$ClamScanPath,
    [Parameter(Mandatory = $true)]
    [string]$AllowedHost,
    [string]$YaraPath = "",
    [string]$YaraRules = "",
    [switch]$Activate,
    [int]$HealthTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$clam = (Resolve-Path -LiteralPath $ClamScanPath).Path
if (-not (Test-Path -LiteralPath $clam -PathType Leaf)) { throw "clamscan.exe not found." }

$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [string](Get-Command python -ErrorAction Stop).Source
}
$probe = & $pythonExe -c "import win32serviceutil; print('ok')" 2>&1
if ($LASTEXITCODE -ne 0) { throw "pywin32 is required. $($probe -join ' ')" }

$serviceSource = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $env:ProgramData "BondsFileSecurity"
$runtimeDir = Join-Path $stateDir "runtime"
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $serviceSource "server.py") -Destination (Join-Path $runtimeDir "server.py") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "security_service.py") -Destination (Join-Path $runtimeDir "security_service.py") -Force

$token = [Environment]::GetEnvironmentVariable("BONDS_FILE_SECURITY_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes)
    [Environment]::SetEnvironmentVariable("BONDS_FILE_SECURITY_TOKEN", $token, "Machine")
}

$serviceHost = Join-Path $runtimeDir "security_service.py"
$existing = Get-Service -Name "BondsFileSecurityService" -ErrorAction SilentlyContinue
if ($existing) {
    & $pythonExe $serviceHost --startup auto update
} else {
    & $pythonExe $serviceHost --startup auto install
}
if ($LASTEXITCODE -ne 0) { throw "Failed to install/update BondsFileSecurityService." }

$envValues = @(
    "BONDS_FILE_SECURITY_TOKEN=$token",
    "BONDS_FILE_SECURITY_HOST=127.0.0.1",
    "BONDS_FILE_SECURITY_PORT=8772",
    "BONDS_FILE_SECURITY_ALLOWED_HOST=$AllowedHost",
    "BONDS_FILE_SECURITY_MAX_BYTES=10485760",
    "BONDS_FILE_SECURITY_RUNTIME_ROOT=$runtimeDir",
    "BONDS_FILE_SECURITY_STATE_DIR=$stateDir",
    "BONDS_CLAMSCAN_PATH=$clam",
    "BONDS_YARA_PATH=$YaraPath",
    "BONDS_YARA_RULES=$YaraRules",
    "BONDS_PYTHON_EXE=$pythonExe"
)
$registry = "HKLM:\SYSTEM\CurrentControlSet\Services\BondsFileSecurityService"
New-ItemProperty -Path $registry -Name "Environment" -PropertyType MultiString -Value $envValues -Force | Out-Null
& sc.exe failure BondsFileSecurityService reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
& sc.exe failureflag BondsFileSecurityService 1 | Out-Null
& sc.exe config BondsFileSecurityService start= auto | Out-Null

if (-not $Activate) {
    Write-Host "Prepared BondsFileSecurityService. Run again with -Activate for health-checked activation."
    exit 0
}

$svc = Get-Service -Name "BondsFileSecurityService"
if ($svc.Status -eq "Running") { Restart-Service BondsFileSecurityService -Force } else { Start-Service BondsFileSecurityService }

$headers = @{ Authorization = "Bearer $token" }
$deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
$healthy = $false
while ((Get-Date) -lt $deadline) {
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:8772/health" -Headers $headers -TimeoutSec 5
        if ($h.ok) { $healthy = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    Stop-Service BondsFileSecurityService -Force -ErrorAction SilentlyContinue
    throw "BondsFileSecurityService did not become healthy. Fail-closed state preserved."
}

Write-Host "BondsFileSecurityService is Running / Automatic and healthy."
