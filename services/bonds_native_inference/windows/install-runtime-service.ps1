param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [switch]$Activate,
    [int]$HealthTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$serviceSource = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $serviceSource "canonical-model.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$model = (Resolve-Path -LiteralPath $ModelPath).Path
if ((Split-Path -Leaf $model) -ne [string]$manifest.artifact) {
    throw "Configured model is not the canonical Bonds artifact: $($manifest.artifact)"
}

$expectedSha = ([string]$manifest.sha256).ToLowerInvariant()
$actualSha = (Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $expectedSha) {
    throw "Canonical GGUF SHA256 mismatch. Expected $expectedSha, got $actualSha."
}

$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [string](Get-Command python -ErrorAction Stop).Source
}
if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    throw "Unable to resolve Python."
}

$probe = & $pythonExe -c "import llama_cpp, win32serviceutil; print('ok')" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Python native service dependencies are unavailable. Install requirements-native-inference.txt first. Details: $($probe -join ' ')"
}

$stateDir = Join-Path $env:ProgramData "BondsNative"
$runtimeDir = Join-Path $stateDir "runtime"
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

foreach ($name in @("server.py", "native_generator.py", "canonical-model.json")) {
    Copy-Item -LiteralPath (Join-Path $serviceSource $name) -Destination (Join-Path $runtimeDir $name) -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "native_service.py") -Destination (Join-Path $runtimeDir "native_service.py") -Force

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured. Refusing to generate or rotate the production token during service preparation."
}

$serviceHost = Join-Path $runtimeDir "native_service.py"
$existingService = Get-Service -Name "BondsNativeRuntimeService" -ErrorAction SilentlyContinue
if ($existingService) {
    & $pythonExe $serviceHost --startup auto update
} else {
    & $pythonExe $serviceHost --startup auto install
}
if ($LASTEXITCODE -ne 0) {
    throw "Failed to install/update BondsNativeRuntimeService."
}

& sc.exe failure BondsNativeRuntimeService reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
& sc.exe failureflag BondsNativeRuntimeService 1 | Out-Null
& sc.exe config BondsNativeRuntimeService start= auto | Out-Null

$serviceEnvironment = @(
    "BONDS_NATIVE_TOKEN=$token",
    "BONDS_NATIVE_HOST=127.0.0.1",
    "BONDS_NATIVE_PORT=8765",
    "BONDS_NATIVE_MODEL_PATH=$model",
    "BONDS_NATIVE_MODEL_SHA256=$expectedSha",
    "BONDS_NATIVE_N_CTX=$([string]$manifest.runtime.n_ctx)",
    "BONDS_NATIVE_N_THREADS=$([string]$manifest.runtime.n_threads)",
    "BONDS_NATIVE_N_GPU_LAYERS=$([string]$manifest.runtime.n_gpu_layers)",
    "BONDS_NATIVE_MAX_TOKENS=$([string]$manifest.runtime.max_tokens)",
    "BONDS_NATIVE_STATE_DIR=$stateDir",
    "BONDS_NATIVE_RUNTIME_ROOT=$runtimeDir",
    "BONDS_PYTHON_EXE=$pythonExe"
)
$serviceRegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\BondsNativeRuntimeService"
New-ItemProperty -Path $serviceRegistryPath -Name "Environment" -PropertyType MultiString -Value $serviceEnvironment -Force | Out-Null

function Test-LocalHealth {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -Headers $headers -TimeoutSec 5
        return [bool]$result.ok
    }
    catch {
        return $false
    }
}

if (-not $Activate) {
    Write-Host "Prepared BondsNativeRuntimeService. Existing runtime path was not changed."
    Write-Host "Run again with -Activate to perform health-checked cutover with rollback."
    exit 0
}

$legacyTask = Get-ScheduledTask -TaskName "BondsNativeRuntime" -ErrorAction SilentlyContinue
$legacyWasEnabled = $false
if ($legacyTask) {
    $legacyWasEnabled = [bool]$legacyTask.Settings.Enabled
    Stop-ScheduledTask -TaskName "BondsNativeRuntime" -ErrorAction SilentlyContinue
}

try {
    Start-Service -Name "BondsNativeRuntimeService"
    $deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalHealth) {
            $healthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if (-not $healthy) {
        throw "BondsNativeRuntimeService did not become healthy before timeout."
    }

    if ($legacyTask) {
        Disable-ScheduledTask -TaskName "BondsNativeRuntime" | Out-Null
    }

    Write-Host "BondsNativeRuntimeService is healthy and configured for Windows boot."
}
catch {
    Stop-Service -Name "BondsNativeRuntimeService" -Force -ErrorAction SilentlyContinue
    if ($legacyTask -and $legacyWasEnabled) {
        Enable-ScheduledTask -TaskName "BondsNativeRuntime" | Out-Null
        Start-ScheduledTask -TaskName "BondsNativeRuntime"
    }
    throw "Runtime service cutover failed and legacy runtime was restored. $($_.Exception.Message)"
}
