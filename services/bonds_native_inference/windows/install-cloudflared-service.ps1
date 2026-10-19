param(
    [string]$CloudflaredConfig = "$env:USERPROFILE\.cloudflared\config.yml",
    [string]$CloudflaredExe = "",
    [switch]$Activate,
    [switch]$CleanupLegacyProcesses,
    [int]$HealthTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$configSource = (Resolve-Path -LiteralPath $CloudflaredConfig).Path
if ([string]::IsNullOrWhiteSpace($CloudflaredExe)) {
    $running = Get-Process cloudflared -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and (Test-Path -LiteralPath $_.Path -PathType Leaf) } |
        Select-Object -First 1
    if ($running) {
        $CloudflaredExe = $running.Path
    } else {
        $command = Get-Command cloudflared.exe -ErrorAction Stop
        $CloudflaredExe = [string]$command.Source
    }
}
$exeSource = (Resolve-Path -LiteralPath $CloudflaredExe).Path
if ([IO.Path]::GetExtension($exeSource).ToLowerInvariant() -ne ".exe") {
    throw "Cloudflared Windows service requires the real cloudflared.exe, not a PowerShell/cmd shim."
}

$rawConfig = Get-Content -LiteralPath $configSource -Raw
$credentialMatch = [regex]::Match(
    $rawConfig,
    "(?im)^\s*credentials-file\s*:\s*['""]?([^'""\r\n]+)['""]?\s*$"
)
if (-not $credentialMatch.Success) {
    throw "Cloudflare config must include credentials-file for a locally-managed tunnel."
}

$credentialSourceText = [Environment]::ExpandEnvironmentVariables($credentialMatch.Groups[1].Value.Trim())
if ([IO.Path]::IsPathRooted($credentialSourceText)) {
    $credentialSource = $credentialSourceText
} else {
    $credentialSource = Join-Path (Split-Path -Parent $configSource) $credentialSourceText
}
$credentialSource = (Resolve-Path -LiteralPath $credentialSource).Path

$stateDir = Join-Path $env:ProgramData "BondsNative"
$cloudflareDir = Join-Path $stateDir "cloudflared"
New-Item -ItemType Directory -Path $cloudflareDir -Force | Out-Null

$exeDest = Join-Path $cloudflareDir "cloudflared.exe"
$configDest = Join-Path $cloudflareDir "config.yml"
$credentialDest = Join-Path $cloudflareDir (Split-Path -Leaf $credentialSource)

if ($exeSource -ne $exeDest) {
    Copy-Item -LiteralPath $exeSource -Destination $exeDest -Force
}
Copy-Item -LiteralPath $credentialSource -Destination $credentialDest -Force

$replacement = "credentials-file: '$credentialDest'"
$serviceConfig = [regex]::Replace(
    $rawConfig,
    "(?im)^\s*credentials-file\s*:\s*['""]?([^'""\r\n]+)['""]?\s*$",
    $replacement,
    1
)
Set-Content -LiteralPath $configDest -Value $serviceConfig -Encoding UTF8

& $exeDest tunnel --config $configDest ingress validate
if ($LASTEXITCODE -ne 0) {
    throw "cloudflared ingress validation failed for the service config."
}

$existing = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
if (-not $existing) {
    & $exeDest service install
    if ($LASTEXITCODE -ne 0) {
        throw "cloudflared service install failed."
    }
}

$q = [char]34
$binPath = "$q$exeDest$q --config=$q$configDest$q tunnel run"
& sc.exe config cloudflared binPath= $binPath start= auto | Out-Null
& sc.exe failure cloudflared reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
& sc.exe failureflag cloudflared 1 | Out-Null

[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", $exeDest, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", $configDest, "Machine")

if (-not $Activate) {
    Write-Host "Prepared cloudflared Windows service. Existing tunnel path was not changed."
    Write-Host "Run again with -Activate to start the service and health-check cutover."
    exit 0
}

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "BONDS_NATIVE_TOKEN is not configured at Machine scope."
}

function Test-RemoteHealth {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $result = Invoke-RestMethod -Uri "https://native.bonds-global.com/health" -Headers $headers -TimeoutSec 8
        return [bool]$result.ok
    }
    catch {
        return $false
    }
}

$service = Get-Service -Name "cloudflared"
if ($service.Status -eq "Running") {
    Restart-Service -Name "cloudflared" -Force
} else {
    Start-Service -Name "cloudflared"
}

$deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
$healthy = $false
while ((Get-Date) -lt $deadline) {
    if (Test-RemoteHealth) {
        $healthy = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    throw "cloudflared Windows service started but remote Native health did not become ready. Legacy tunnel was left untouched."
}

$legacyTask = Get-ScheduledTask -TaskName "BondsNativeTunnel" -ErrorAction SilentlyContinue
if ($legacyTask) {
    Disable-ScheduledTask -TaskName "BondsNativeTunnel" | Out-Null
    Stop-ScheduledTask -TaskName "BondsNativeTunnel" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5

    if (-not (Test-RemoteHealth)) {
        Enable-ScheduledTask -TaskName "BondsNativeTunnel" | Out-Null
        Start-ScheduledTask -TaskName "BondsNativeTunnel"
        throw "Remote health failed after legacy tunnel shutdown; legacy task was restored."
    }
}

if ($CleanupLegacyProcesses) {
    $servicePid = (Get-CimInstance Win32_Service -Filter "Name='cloudflared'").ProcessId
    Get-Process cloudflared -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -ne $servicePid } |
        Stop-Process -Force

    Start-Sleep -Seconds 3
    if (-not (Test-RemoteHealth)) {
        throw "Remote health failed after legacy process cleanup."
    }
}

Write-Host "cloudflared service is healthy and configured for Windows boot."
