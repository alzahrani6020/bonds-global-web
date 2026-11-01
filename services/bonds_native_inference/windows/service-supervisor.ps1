<#
.SYNOPSIS
  Health supervisor for the Bonds Windows services (Native runtime, token runtime, Cloudflared tunnel).

.DESCRIPTION
  Windows Service Control Manager only restarts a service when its process CRASHES.
  It cannot detect a service that is running but hung / not answering. This supervisor
  fills that gap. It replaces the legacy watchdog.ps1, which managed scheduled tasks
  that no longer exist since the migration to Windows services.

  Safeguards (so the supervisor never makes an outage worse):
    * FailureThreshold consecutive failed probes before any restart.
    * StartupGraceSeconds after a restart during which failures are not counted
      (the Native model needs time to load).
    * CooldownSeconds minimum gap between restarts of the same service.
    * MaxRestartsPerHour per service; beyond it the supervisor stops restarting and alerts.
    * The tunnel is only restarted when the local runtime is healthy AND the general
      internet is reachable (restarting cloudflared cannot fix a dead network).
    * -Once is strictly report-only: it never restarts anything.

  Run as SYSTEM via install-service-supervisor.ps1. Needs no secret besides the
  machine-level BONDS_NATIVE_TOKEN that already exists for the runtime.
#>
param(
    [int]$IntervalSeconds = 30,
    [int]$FailureThreshold = 3,
    [int]$CooldownSeconds = 300,
    [int]$StartupGraceSeconds = 180,
    [int]$ServiceGraceSeconds = 60,
    [int]$MaxRestartsPerHour = 6,
    [int]$ProbeTimeoutSeconds = 8,
    [string]$NativeService = "BondsNativeRuntimeService",
    [string]$TokenService = "BondsTokenRuntimeService",
    [string]$TunnelService = "Cloudflared",
    [string]$LocalNativeUrl = "http://127.0.0.1:8765/health",
    [string]$TokenUrl = "http://127.0.0.1:8771/health",
    [string]$RemoteNativeUrl = "https://native.bonds-global.com/health",
    [string]$ConnectivityUrl = "https://www.cloudflare.com/cdn-cgi/trace",
    [string]$StateDir = "",
    [switch]$DryRun,
    [switch]$Once
)

$ErrorActionPreference = "Stop"

if ($Once) { $DryRun = $true }

# NOTE: PowerShell variables are case-insensitive; $stateDir is the -StateDir parameter.
if ([string]::IsNullOrWhiteSpace($stateDir)) {
    $stateDir = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_STATE_DIR", "Machine")
}
if ([string]::IsNullOrWhiteSpace($stateDir)) {
    $stateDir = Join-Path $env:ProgramData "BondsNative"
}
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$logPath = Join-Path $stateDir "service-supervisor.log"
$heartbeatPath = Join-Path $stateDir "service-supervisor-heartbeat.json"
$maxLogBytes = 5MB

$nativeToken = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($nativeToken)) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured."
}
$nativeHeaders = @{ Authorization = "Bearer $nativeToken" }
$alertWebhook = [Environment]::GetEnvironmentVariable("BONDS_SUPERVISOR_ALERT_WEBHOOK", "Machine")

function Write-SupervisorLog {
    param([string]$Message)
    try {
        if ((Test-Path -LiteralPath $logPath) -and ((Get-Item -LiteralPath $logPath).Length -gt $maxLogBytes)) {
            Move-Item -LiteralPath $logPath -Destination "$logPath.1" -Force
        }
        Add-Content -LiteralPath $logPath -Value ("{0:o} {1}" -f (Get-Date), $Message)
    } catch {
        # Logging must never break supervision.
    }
}

function Send-SupervisorAlert {
    param([string]$Message)
    if ([string]::IsNullOrWhiteSpace($alertWebhook) -or $DryRun) { return }
    try {
        $payload = @{ text = "[Bonds supervisor] $Message"; content = "[Bonds supervisor] $Message" } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Post -Uri $alertWebhook -ContentType "application/json" -Body $payload -TimeoutSec 10 | Out-Null
    } catch {
        Write-SupervisorLog "alert delivery failed: $($_.Exception.Message)"
    }
}

# Returns @{ reachable; status; body }. reachable=$true means an HTTP response arrived
# (even 401/530); reachable=$false means connection refused / timeout / DNS failure.
function Invoke-Probe {
    param([string]$Uri, [hashtable]$Headers = @{})
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Uri -Headers $Headers -TimeoutSec $ProbeTimeoutSeconds
        $body = $null
        try { $body = $response.Content | ConvertFrom-Json } catch { $body = $null }
        return @{ reachable = $true; status = [int]$response.StatusCode; body = $body }
    } catch {
        $status = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $null }
        }
        return @{ reachable = ($null -ne $status); status = $status; body = $null }
    }
}

function Get-ServiceStateSafe {
    param([string]$Name)
    try { return [string](Get-Service -Name $Name -ErrorAction Stop).Status } catch { return "Missing" }
}

function Test-NativeHealthy {
    $p = Invoke-Probe -Uri $LocalNativeUrl -Headers $nativeHeaders
    return [bool]($p.status -eq 200 -and $p.body -and $p.body.ok -eq $true -and $p.body.runtime.available -eq $true)
}

# The token runtime answers 401 to an unauthenticated /health. Any 200/401 proves the process is serving.
function Test-TokenHealthy {
    $p = Invoke-Probe -Uri $TokenUrl
    return [bool]($p.status -eq 200 -or $p.status -eq 401)
}

function Test-TunnelHealthy {
    $p = Invoke-Probe -Uri $RemoteNativeUrl -Headers $nativeHeaders
    return [bool]($p.status -eq 200 -and $p.body -and $p.body.ok -eq $true -and $p.body.runtime.available -eq $true)
}

function Test-InternetReachable {
    $p = Invoke-Probe -Uri $ConnectivityUrl
    return [bool]$p.reachable
}

function New-TargetState {
    param([string]$Name, [string]$Service, [int]$GraceSeconds)
    return @{
        name = $Name
        service = $Service
        graceSeconds = $GraceSeconds
        failures = 0
        graceUntil = [DateTime]::MinValue
        lastRestart = [DateTime]::MinValue
        restarts = New-Object System.Collections.ArrayList
        gaveUp = $false
        lastResult = "unknown"
    }
}

function Restart-ServiceHard {
    param([string]$Service)

    $processId = 0
    try { $processId = [int](Get-CimInstance Win32_Service -Filter "Name='$Service'" -ErrorAction Stop).ProcessId } catch { $processId = 0 }

    & sc.exe stop $Service | Out-Null
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ((Get-ServiceStateSafe -Name $Service) -eq "Stopped") { break }
        Start-Sleep -Seconds 1
    }
    if ((Get-ServiceStateSafe -Name $Service) -ne "Stopped" -and $processId -gt 0) {
        Write-SupervisorLog "service=$Service did not stop in 30s; killing pid=$processId"
        try { Stop-Process -Id $processId -Force -ErrorAction Stop } catch { Write-SupervisorLog "kill failed pid=${processId}: $($_.Exception.Message)" }
        Start-Sleep -Seconds 3
    }

    & sc.exe start $Service | Out-Null
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ((Get-ServiceStateSafe -Name $Service) -eq "Running") { return $true }
        Start-Sleep -Seconds 1
    }
    return ((Get-ServiceStateSafe -Name $Service) -eq "Running")
}

function Invoke-Recovery {
    param($Target, [string]$Reason)

    $now = Get-Date
    if ($Target.gaveUp) { return "gave_up" }

    # Maintenance switch: `New-Item $env:ProgramData\BondsNative\supervisor.paused` stops all recovery.
    if (Test-Path -LiteralPath (Join-Path $stateDir "supervisor.paused")) {
        Write-SupervisorLog "recovery paused (supervisor.paused present) service=$($Target.service) reason=$Reason"
        return "paused"
    }

    if (($now - $Target.lastRestart).TotalSeconds -lt $CooldownSeconds) {
        Write-SupervisorLog "restart suppressed service=$($Target.service) reason=$Reason cooldown_seconds=$CooldownSeconds"
        return "cooldown"
    }

    $recent = @($Target.restarts | Where-Object { ($now - $_).TotalMinutes -lt 60 })
    $Target.restarts.Clear()
    foreach ($t in $recent) { [void]$Target.restarts.Add($t) }
    if ($Target.restarts.Count -ge $MaxRestartsPerHour) {
        $Target.gaveUp = $true
        Write-SupervisorLog "GAVE UP service=$($Target.service) restarts_last_hour=$($Target.restarts.Count) reason=$Reason"
        Send-SupervisorAlert "Gave up restarting $($Target.service) after $($Target.restarts.Count) restarts in the last hour. Manual intervention required."
        return "gave_up"
    }

    if ($DryRun) {
        Write-SupervisorLog "DRY-RUN would restart service=$($Target.service) reason=$Reason"
        return "dry_run"
    }

    Write-SupervisorLog "restarting service=$($Target.service) reason=$Reason"
    $ok = $false
    try { $ok = Restart-ServiceHard -Service $Target.service } catch { Write-SupervisorLog "restart error service=$($Target.service): $($_.Exception.Message)" }

    $Target.lastRestart = Get-Date
    [void]$Target.restarts.Add($Target.lastRestart)
    $Target.graceUntil = (Get-Date).AddSeconds($Target.graceSeconds)
    $Target.failures = 0
    Write-SupervisorLog "restart finished service=$($Target.service) running=$ok"
    Send-SupervisorAlert "Restarted $($Target.service) (reason: $Reason). Running=$ok"
    if ($ok) { return "restarted" }
    return "restart_failed"
}

# Updates failure counters and recovers when the threshold is reached. Returns a result string.
function Update-Target {
    param($Target, [bool]$Healthy, [string]$ServiceState, [string]$Detail)

    $now = Get-Date

    if ($Healthy) {
        if ($Target.failures -gt 0 -or $Target.gaveUp) {
            Write-SupervisorLog "recovered service=$($Target.service)"
        }
        $Target.failures = 0
        $Target.gaveUp = $false
        $Target.lastResult = "healthy"
        return "healthy"
    }

    if ($ServiceState -eq "Missing") {
        $Target.lastResult = "service_missing"
        return "service_missing"
    }

    # SCM is already starting/stopping it (e.g. its own crash-recovery); do not interfere.
    if ($ServiceState -match "Pending$") {
        $Target.lastResult = "service_pending"
        return "service_pending"
    }

    # A stopped service is an unambiguous failure: no need to wait for the threshold.
    if ($ServiceState -ne "Running") {
        $Target.lastResult = "service_$($ServiceState.ToLowerInvariant())"
        if ($Once) { return $Target.lastResult }
        $action = Invoke-Recovery -Target $Target -Reason "service_state=$ServiceState"
        return "$($Target.lastResult):$action"
    }

    if ($now -lt $Target.graceUntil) {
        $Target.lastResult = "starting"
        return "starting"
    }

    $Target.failures++
    $Target.lastResult = "unhealthy"
    if ($Once) { return "unhealthy" }

    if ($Target.failures -ge $FailureThreshold) {
        $action = Invoke-Recovery -Target $Target -Reason "health_probe_failed x$($Target.failures) $Detail"
        return "unhealthy:$action"
    }
    return "unhealthy:$($Target.failures)/$FailureThreshold"
}

$native = New-TargetState -Name "native" -Service $NativeService -GraceSeconds $StartupGraceSeconds
$token = New-TargetState -Name "token_runtime" -Service $TokenService -GraceSeconds $ServiceGraceSeconds
$tunnel = New-TargetState -Name "tunnel" -Service $TunnelService -GraceSeconds $ServiceGraceSeconds
# After boot or wake-from-sleep give everything a chance to come up before counting failures.
$native.graceUntil = (Get-Date).AddSeconds($StartupGraceSeconds)
$token.graceUntil = (Get-Date).AddSeconds($ServiceGraceSeconds)
$tunnel.graceUntil = (Get-Date).AddSeconds($ServiceGraceSeconds)
if ($Once) {
    $native.graceUntil = [DateTime]::MinValue
    $token.graceUntil = [DateTime]::MinValue
    $tunnel.graceUntil = [DateTime]::MinValue
}

Write-SupervisorLog "supervisor started interval=$IntervalSeconds threshold=$FailureThreshold cooldown=$CooldownSeconds grace=$StartupGraceSeconds max_restarts_per_hour=$MaxRestartsPerHour dry_run=$DryRun once=$Once"

$lastCycleAt = Get-Date
do {
    $cycleStart = Get-Date

    # A large gap since the previous cycle means the machine slept/hibernated. Treat it like a fresh boot.
    if (-not $Once -and (($cycleStart - $lastCycleAt).TotalSeconds -gt ($IntervalSeconds * 4 + 60))) {
        Write-SupervisorLog "resume detected gap_seconds=$([int]($cycleStart - $lastCycleAt).TotalSeconds); applying startup grace"
        $native.graceUntil = $cycleStart.AddSeconds($StartupGraceSeconds)
        $token.graceUntil = $cycleStart.AddSeconds($ServiceGraceSeconds)
        $tunnel.graceUntil = $cycleStart.AddSeconds($ServiceGraceSeconds + 30)
        $native.failures = 0; $token.failures = 0; $tunnel.failures = 0
    }
    $lastCycleAt = $cycleStart

    $nativeState = Get-ServiceStateSafe -Name $native.service
    $nativeHealthy = $false
    if ($nativeState -eq "Running") { $nativeHealthy = Test-NativeHealthy }
    $nativeResult = Update-Target -Target $native -Healthy $nativeHealthy -ServiceState $nativeState -Detail "local=$LocalNativeUrl"

    $tokenState = Get-ServiceStateSafe -Name $token.service
    $tokenHealthy = $false
    if ($tokenState -eq "Running") { $tokenHealthy = Test-TokenHealthy }
    $tokenResult = Update-Target -Target $token -Healthy $tokenHealthy -ServiceState $tokenState -Detail "local=$TokenUrl"

    $tunnelState = Get-ServiceStateSafe -Name $tunnel.service
    $tunnelHealthy = $false
    $tunnelResult = "skipped_native_unhealthy"
    $internet = $null
    if ($nativeHealthy) {
        if ($tunnelState -eq "Running") { $tunnelHealthy = Test-TunnelHealthy }
        if (-not $tunnelHealthy -and $tunnelState -eq "Running") {
            $internet = Test-InternetReachable
            if (-not $internet) {
                # Network is down: restarting cloudflared cannot help. Do not count this against the tunnel.
                $tunnelResult = "network_down"
                $tunnel.lastResult = "network_down"
            }
        }
        if ($tunnelResult -ne "network_down") {
            $tunnelResult = Update-Target -Target $tunnel -Healthy $tunnelHealthy -ServiceState $tunnelState -Detail "remote=$RemoteNativeUrl"
        }
    }

    $heartbeat = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        dry_run = [bool]$DryRun
        on_battery = $null
        native = [ordered]@{ service = $nativeState; healthy = $nativeHealthy; result = $nativeResult; failures = $native.failures; gave_up = $native.gaveUp }
        token_runtime = [ordered]@{ service = $tokenState; healthy = $tokenHealthy; result = $tokenResult; failures = $token.failures; gave_up = $token.gaveUp }
        tunnel = [ordered]@{ service = $tunnelState; healthy = $tunnelHealthy; result = $tunnelResult; failures = $tunnel.failures; gave_up = $tunnel.gaveUp; internet = $internet }
    }
    try {
        $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop | Select-Object -First 1
        if ($battery) { $heartbeat.on_battery = ($battery.BatteryStatus -eq 1) }
    } catch { }

    try {
        $tempHeartbeat = "$heartbeatPath.tmp"
        $heartbeat | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $tempHeartbeat -Encoding UTF8
        Move-Item -LiteralPath $tempHeartbeat -Destination $heartbeatPath -Force
    } catch {
        Write-SupervisorLog "heartbeat write failed: $($_.Exception.Message)"
    }

    if ($Once) {
        $heartbeat | ConvertTo-Json -Depth 4
        if ($nativeHealthy -and $tokenHealthy -and $tunnelHealthy) { exit 0 }
        exit 1
    }

    $line = "status native=$nativeResult token=$tokenResult tunnel=$tunnelResult"
    if ($nativeResult -ne "healthy" -or $tokenResult -ne "healthy" -or ($tunnelResult -ne "healthy")) {
        Write-SupervisorLog $line
    }

    $elapsed = ((Get-Date) - $cycleStart).TotalSeconds
    Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds - [int]$elapsed))
} while ($true)
