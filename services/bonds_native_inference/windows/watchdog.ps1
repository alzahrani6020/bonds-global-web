# DEPRECATED: this watchdog manages the retired BondsNativeRuntime/BondsNativeTunnel scheduled tasks.
# Production now runs as Windows services; use service-supervisor.ps1 / install-service-supervisor.ps1 instead.
# Do not enable this next to the services: it would try to start a second runtime and tunnel.
param(
    [int]$IntervalSeconds = 15,
    [int]$RecoveryDelaySeconds = 10,
    [int]$FailureThreshold = 3,
    [int]$CooldownSeconds = 60,
    [string]$RemoteHealthUrl = "https://native.bonds-global.com/health"
)

$ErrorActionPreference = "Stop"

$stateDir = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_STATE_DIR", "Machine")
$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($stateDir)) {
    $stateDir = Join-Path $env:ProgramData "BondsNative"
}
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured."
}

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$logPath = Join-Path $stateDir "native-watchdog.log"
$heartbeatPath = Join-Path $stateDir "heartbeat.json"
$headers = @{ Authorization = "Bearer $token" }

$localFailures = 0
$remoteFailures = 0
$lastRuntimeRestart = [DateTime]::MinValue
$lastTunnelRestart = [DateTime]::MinValue

function Write-WatchdogLog {
    param([string]$Message)
    Add-Content -LiteralPath $logPath -Value ("{0:o} {1}" -f (Get-Date), $Message)
}

function Get-TaskStateSafe {
    param([string]$TaskName)
    try {
        return [string](Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop).State
    } catch {
        return "Missing"
    }
}

function Test-Health {
    param([string]$Uri, [int]$TimeoutSeconds = 5)
    try {
        $health = Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers -TimeoutSec $TimeoutSeconds
        return ($health.ok -eq $true)
    } catch {
        return $false
    }
}

function Restart-BondsTask {
    param(
        [string]$TaskName,
        [ref]$LastRestart
    )

    $now = Get-Date
    if (($now - $LastRestart.Value).TotalSeconds -lt $CooldownSeconds) {
        Write-WatchdogLog "restart suppressed task=$TaskName cooldown_seconds=$CooldownSeconds"
        return $false
    }

    try {
        $state = Get-TaskStateSafe -TaskName $TaskName
        if ($state -eq "Running") {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $LastRestart.Value = $now
        Write-WatchdogLog "restarted task=$TaskName previous_state=$state"
        return $true
    } catch {
        Write-WatchdogLog "restart failed task=$TaskName error=$($_.Exception.Message)"
        return $false
    }
}

Write-WatchdogLog "watchdog started interval_seconds=$IntervalSeconds threshold=$FailureThreshold cooldown_seconds=$CooldownSeconds"

while ($true) {
    $lastAction = "none"

    $runtimeState = Get-TaskStateSafe -TaskName "BondsNativeRuntime"
    if ($runtimeState -ne "Running") {
        $localFailures = [Math]::Max($localFailures, $FailureThreshold)
    }

    $localOk = Test-Health -Uri "http://127.0.0.1:8765/health"
    if ($localOk) {
        $localFailures = 0
    } else {
        $localFailures++
    }

    if ($localFailures -ge $FailureThreshold) {
        if (Restart-BondsTask -TaskName "BondsNativeRuntime" -LastRestart ([ref]$lastRuntimeRestart)) {
            $lastAction = "recover_runtime"
            Start-Sleep -Seconds $RecoveryDelaySeconds
            $localOk = Test-Health -Uri "http://127.0.0.1:8765/health"
            if ($localOk) { $localFailures = 0 }
        }
    }

    $tunnelState = Get-TaskStateSafe -TaskName "BondsNativeTunnel"
    if ($tunnelState -ne "Running") {
        $remoteFailures = [Math]::Max($remoteFailures, $FailureThreshold)
    }

    $remoteOk = $false
    if ($localOk) {
        $remoteOk = Test-Health -Uri $RemoteHealthUrl -TimeoutSeconds 8
        if ($remoteOk) {
            $remoteFailures = 0
        } else {
            $remoteFailures++
        }
    }

    if ($localOk -and $remoteFailures -ge $FailureThreshold) {
        if (Restart-BondsTask -TaskName "BondsNativeTunnel" -LastRestart ([ref]$lastTunnelRestart)) {
            $lastAction = "recover_tunnel"
            Start-Sleep -Seconds $RecoveryDelaySeconds
            $remoteOk = Test-Health -Uri $RemoteHealthUrl -TimeoutSeconds 8
            if ($remoteOk) { $remoteFailures = 0 }
        }
    }

    $heartbeat = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        host_online = $true
        local_health_ok = [bool]$localOk
        remote_health_ok = [bool]$remoteOk
        runtime_task = Get-TaskStateSafe -TaskName "BondsNativeRuntime"
        tunnel_task = Get-TaskStateSafe -TaskName "BondsNativeTunnel"
        local_failures = $localFailures
        remote_failures = $remoteFailures
        last_action = $lastAction
    }

    $tempHeartbeat = "$heartbeatPath.tmp"
    $heartbeat | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $tempHeartbeat -Encoding UTF8
    Move-Item -LiteralPath $tempHeartbeat -Destination $heartbeatPath -Force

    Write-WatchdogLog "status local=$localOk remote=$remoteOk local_failures=$localFailures remote_failures=$remoteFailures action=$lastAction"
    Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
}
