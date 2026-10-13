param()

$ErrorActionPreference = "Stop"

$repoRoot = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_REPO_ROOT", "Machine")
$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
$model = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_MODEL_PATH", "Machine")

if ([string]::IsNullOrWhiteSpace($repoRoot)) { throw "BONDS_NATIVE_REPO_ROOT is not configured." }
if ([string]::IsNullOrWhiteSpace($pythonExe)) { throw "BONDS_PYTHON_EXE is not configured." }
if ([string]::IsNullOrWhiteSpace($token)) { throw "BONDS_NATIVE_TOKEN is not configured." }
if ([string]::IsNullOrWhiteSpace($model)) { throw "BONDS_NATIVE_MODEL_PATH is not configured." }

$machineVars = @(
    "BONDS_NATIVE_TOKEN",
    "BONDS_NATIVE_HOST",
    "BONDS_NATIVE_PORT",
    "BONDS_NATIVE_MODEL_PATH",
    "BONDS_NATIVE_N_CTX",
    "BONDS_NATIVE_N_THREADS",
    "BONDS_NATIVE_N_GPU_LAYERS",
    "BONDS_NATIVE_MAX_TOKENS"
)

foreach ($name in $machineVars) {
    $value = [Environment]::GetEnvironmentVariable($name, "Machine")
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        Set-Item -Path "Env:$name" -Value $value
    }
}

$serviceDir = Join-Path $repoRoot "services\bonds_native_inference"
Set-Location -LiteralPath $serviceDir
& $pythonExe "server.py"
exit $LASTEXITCODE
