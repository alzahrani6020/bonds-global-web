param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [string]$TunnelName = "bonds-native",
    [string]$CloudflaredConfig = "$env:USERPROFILE\.cloudflared\config.yml",
    [int]$NCtx = 4096,
    [int]$NThreads = 10,
    [int]$NGpuLayers = -1,
    [int]$MaxTokens = 512
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer once from an elevated PowerShell window."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$model = (Resolve-Path -LiteralPath $ModelPath).Path
$cfConfig = (Resolve-Path -LiteralPath $CloudflaredConfig).Path
$pythonExe = (Get-Command python -ErrorAction Stop).Source
$cloudflaredExe = (Get-Command cloudflared -ErrorAction Stop).Source

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes)
    [Environment]::SetEnvironmentVariable("BONDS_NATIVE_TOKEN", $token, "Machine")
}

[Environment]::SetEnvironmentVariable("BONDS_NATIVE_HOST", "127.0.0.1", "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_PORT", "8765", "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_MODEL_PATH", $model, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_N_CTX", [string]$NCtx, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_N_THREADS", [string]$NThreads, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_N_GPU_LAYERS", [string]$NGpuLayers, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_MAX_TOKENS", [string]$MaxTokens, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_REPO_ROOT", $repoRoot, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", $cloudflaredExe, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", $cfConfig, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_CLOUDFLARED_TUNNEL", $TunnelName, "Machine")
[Environment]::SetEnvironmentVariable("BONDS_PYTHON_EXE", $pythonExe, "Machine")

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$nativeScript = Join-Path $PSScriptRoot "run-native.ps1"
$tunnelScript = Join-Path $PSScriptRoot "run-tunnel.ps1"

$nativeAction = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$nativeScript`""
$tunnelAction = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$tunnelScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "BondsNativeRuntime" -Action $nativeAction -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName "BondsNativeTunnel" -Action $tunnelAction -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Force | Out-Null

Start-ScheduledTask -TaskName "BondsNativeRuntime"
Start-ScheduledTask -TaskName "BondsNativeTunnel"

Write-Host "Installed Bonds Native startup automation."
Write-Host "Runtime task: BondsNativeRuntime"
Write-Host "Tunnel task:  BondsNativeTunnel"
Write-Host "Secrets are read from machine environment and are not stored in Git."
