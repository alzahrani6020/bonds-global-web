param(
    [switch]$Uninstall,
    [switch]$RemoveLegacyWatchdog,
    [int]$IntervalSeconds = 30,
    [int]$FailureThreshold = 3
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$taskName = "BondsServiceSupervisor"
$stateDir = Join-Path $env:ProgramData "BondsNative"
$runtimeDir = Join-Path $stateDir "runtime"
$installedScript = Join-Path $runtimeDir "service-supervisor.ps1"

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    Write-Host "Removed scheduled task $taskName (service files left in place)."
    exit 0
}

foreach ($serviceName in @("BondsNativeRuntimeService", "BondsTokenRuntimeService", "Cloudflared")) {
    if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) {
        throw "Required service not found: $serviceName. Install the services first."
    }
}
if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine"))) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured."
}

# Run from a stable location (not a git worktree that may be deleted or switched).
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "service-supervisor.ps1") -Destination $installedScript -Force

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedScript`" -IntervalSeconds $IntervalSeconds -FailureThreshold $FailureThreshold"
$action = New-ScheduledTaskAction -Execute $psExe -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# AllowStartIfOnBatteries / DontStopIfGoingOnBatteries: the host is a laptop and must keep supervising on battery.
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Description "Bonds services health supervisor (Native, token runtime, Cloudflared)." -Force | Out-Null

if ($RemoveLegacyWatchdog) {
    $legacy = Get-ScheduledTask -TaskName "BondsNativeWatchdog" -ErrorAction SilentlyContinue
    if ($legacy) {
        Stop-ScheduledTask -TaskName "BondsNativeWatchdog" -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName "BondsNativeWatchdog" -Confirm:$false
        Write-Host "Removed obsolete scheduled task BondsNativeWatchdog."
    }
}

Start-ScheduledTask -TaskName $taskName

Write-Host "Installed $taskName (SYSTEM, at startup, runs on battery)."
Write-Host "Script:    $installedScript"
Write-Host "Log:       $(Join-Path $stateDir 'service-supervisor.log')"
Write-Host "Heartbeat: $(Join-Path $stateDir 'service-supervisor-heartbeat.json')"
Write-Host "Pause recovery for maintenance: New-Item '$(Join-Path $stateDir 'supervisor.paused')' ; resume: Remove-Item it."
