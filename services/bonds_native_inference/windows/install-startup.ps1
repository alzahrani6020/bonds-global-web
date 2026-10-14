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

$pythonCommand = Get-Command python -ErrorAction Stop
$pythonExe = [string]$pythonCommand.Source
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    throw "Unable to resolve Python."
}

$pythonProbe = & $pythonExe -c "import sys, llama_cpp; print(sys.executable)" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Python cannot import llama_cpp: $($pythonProbe -join ' ')"
}

$cloudflaredCommand = Get-Command cloudflared -ErrorAction Stop
$cloudflaredExe = [string]$cloudflaredCommand.Source
if ([string]::IsNullOrWhiteSpace($cloudflaredExe) -or -not (Test-Path -LiteralPath $cloudflaredExe -PathType Leaf)) {
    throw "Unable to resolve cloudflared."
}

$stateDir = Join-Path $env:ProgramData "BondsNative"
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes)
    [Environment]::SetEnvironmentVariable("BONDS_NATIVE_TOKEN", $token, "Machine")
}

$machineValues = @{
    BONDS_NATIVE_HOST = "127.0.0.1"
    BONDS_NATIVE_PORT = "8765"
    BONDS_NATIVE_MODEL_PATH = $model
    BONDS_NATIVE_N_CTX = [string]$NCtx
    BONDS_NATIVE_N_THREADS = [string]$NThreads
    BONDS_NATIVE_N_GPU_LAYERS = [string]$NGpuLayers
    BONDS_NATIVE_MAX_TOKENS = [string]$MaxTokens
    BONDS_NATIVE_REPO_ROOT = $repoRoot
    BONDS_NATIVE_STATE_DIR = $stateDir
    BONDS_CLOUDFLARED_EXE = $cloudflaredExe
    BONDS_CLOUDFLARED_CONFIG = $cfConfig
    BONDS_CLOUDFLARED_TUNNEL = $TunnelName
    BONDS_PYTHON_EXE = $pythonExe
}

foreach ($entry in $machineValues.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Machine")
}

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$nativeScript = Join-Path $PSScriptRoot "run-native.ps1"
$tunnelScript = Join-Path $PSScriptRoot "run-tunnel.ps1"

$nativeAction = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$nativeScript`""
$tunnelAction = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$tunnelScript`""

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$interactivePrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "BondsNativeRuntime" -Action $nativeAction -Trigger $logonTrigger -Principal $interactivePrincipal -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName "BondsNativeTunnel" -Action $tunnelAction -Trigger $logonTrigger -Principal $interactivePrincipal -Settings $settings -Force | Out-Null

Start-ScheduledTask -TaskName "BondsNativeRuntime"
Start-ScheduledTask -TaskName "BondsNativeTunnel"

Write-Host "Installed Bonds Native startup automation."
Write-Host "Runtime task: BondsNativeRuntime ($($identity.Name), Interactive)"
Write-Host "Tunnel task:  BondsNativeTunnel ($($identity.Name), Interactive)"
Write-Host "Trigger:      At logon"
Write-Host "Python:       $pythonExe"
Write-Host "Cloudflared:  $cloudflaredExe"
Write-Host "State dir:    $stateDir"
