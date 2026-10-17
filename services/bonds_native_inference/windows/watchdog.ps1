param(
    [int]$IntervalSeconds = 15,
    [int]$RecoveryDelaySeconds = 10,
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

function Restart-BondsTask {
    param([string]$TaskName)
    try {
        $state = Get-TaskStateSafe -TaskName $TaskName
        if ($state -eq "Running") {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        Write-WatchdogLog "restarted task=$TaskName previous_state=$state"
        return $true
    } catch {
        Write-WatchdogLog "restart failed task=$TaskName error=$($_.Exception.Message)"
        return $false
    }
}

function Test-Health {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 5
    )
    try {
        $health = Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers -TimeoutSec $TimeoutSeconds
        return ($health.ok -eq $true)
    } catch {
        return $false
    }
}

Write-WatchdogLog "watchdog started interval_seconds=$IntervalSeconds"

while ($true) {
    $lastAction = "none"
    $runtimeState = Get-TaskStateSafe -TaskName "BondsNativeRuntime"
    $tunnelState = Get-TaskStateSafe -TaskName "BondsNativeTunnel"

    if ($runtimeState -ne "Running") {
        if (Restart-BondsTask -TaskName "BondsNativeRuntime") {
            $lastAction = "restart_runtime"
        }
        Start-Sleep -Seconds $RecoveryDelaySeconds
    }

    $localOk = Test-Health -Uri "http://127.0.0.1:8765/health"

    if (-not $localOk) {
        if (Restart-BondsTask -TaskName "BondsNativeRuntime") {
            $lastAction = "recover_runtime"
        }
        Start-Sleep -Seconds $RecoveryDelaySeconds
        $localOk = Test-Health -Uri "http://127.0.0.1:8765/health"
    }

    $runtimeState = Get-TaskStateSafe -TaskName "BondsNativeRuntime"
    $tunnelState = Get-TaskStateSafe -TaskName "BondsNativeTunnel"

    if ($tunnelState -ne "Running") {
        if (Restart-BondsTask -TaskName "BondsNativeTunnel") {
            $lastAction = "restart_tunnel"
        }
        Start-Sleep -Seconds $RecoveryDelaySeconds
    }

    $remoteOk = $false
    if ($localOk) {
        $remoteOk = Test-Health -Uri $RemoteHealthUrl -TimeoutSeconds 8
        if (-not $remoteOk) {
            if (Restart-BondsTask -TaskName "BondsNativeTunnel") {
                $lastAction = "recover_tunnel"
            }
            Start-Sleep -Seconds $RecoveryDelaySeconds
            $remoteOk = Test-Health -Uri $RemoteHealthUrl -TimeoutSeconds 8
        }
    }

    $heartbeat = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        host_online = $true
        local_health_ok = [bool]$localOk
        remote_health_ok = [bool]$remoteOk
        runtime_task = Get-TaskStateSafe -TaskName "BondsNativeRuntime"
        tunnel_task = Get-TaskStateSafe -TaskName "BondsNativeTunnel"
        last_action = $lastAction
    }

    $tempHeartbeat = "$heartbeatPath.tmp"
    $heartbeat | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $tempHeartbeat -Encoding UTF8
    Move-Item -LiteralPath $tempHeartbeat -Destination $heartbeatPath -Force

    if ($localOk -and $remoteOk) {
        Write-WatchdogLog "healthy local=true remote=true runtime=$($heartbeat.runtime_task) tunnel=$($heartbeat.tunnel_task)"
    } else {
        Write-WatchdogLog "degraded local=$localOk remote=$remoteOk runtime=$($heartbeat.runtime_task) tunnel=$($heartbeat.tunnel_task) action=$lastAction"
    }

    Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
}
