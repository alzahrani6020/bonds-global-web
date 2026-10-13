param()

$ErrorActionPreference = "Stop"

$repoRoot = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_REPO_ROOT", "Machine")
$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
$model = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_MODEL_PATH", "Machine")
$stateDir = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_STATE_DIR", "Machine")

if ([string]::IsNullOrWhiteSpace($stateDir)) {
    $stateDir = Join-Path $env:ProgramData "BondsNative"
}
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$logPath = Join-Path $stateDir "native-runtime.log"

function Write-RuntimeLog {
    param([string]$Message)
    Add-Content -LiteralPath $logPath -Value ("{0:o} {1}" -f (Get-Date), $Message)
}

try {
    Write-RuntimeLog "starting BondsNativeRuntime user=$([Security.Principal.WindowsIdentity]::GetCurrent().Name)"

    if ([string]::IsNullOrWhiteSpace($repoRoot)) { throw "BONDS_NATIVE_REPO_ROOT is not configured." }
    if ([string]::IsNullOrWhiteSpace($pythonExe)) { throw "BONDS_PYTHON_EXE is not configured." }
    if ([string]::IsNullOrWhiteSpace($token)) { throw "BONDS_NATIVE_TOKEN is not configured." }
    if ([string]::IsNullOrWhiteSpace($model)) { throw "BONDS_NATIVE_MODEL_PATH is not configured." }
    if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) { throw "Python executable not found: $pythonExe" }
    if (-not (Test-Path -LiteralPath $model -PathType Leaf)) { throw "GGUF model not found: $model" }

    $serviceDir = Join-Path $repoRoot "services\bonds_native_inference"
    $serverPath = Join-Path $serviceDir "server.py"
    if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) { throw "Native server not found: $serverPath" }

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

    $probe = & $pythonExe -c "import sys, llama_cpp; print(sys.executable)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python/llama_cpp preflight failed: $($probe -join ' ')"
    }
    Write-RuntimeLog "preflight ok python=$($probe | Select-Object -Last 1)"

    Set-Location -LiteralPath $serviceDir
    Write-RuntimeLog "launching server.py on 127.0.0.1:8765"
    & $pythonExe $serverPath *>> $logPath
    $exitCode = $LASTEXITCODE
    Write-RuntimeLog "server.py exited code=$exitCode"
    exit $exitCode
}
catch {
    Write-RuntimeLog "fatal: $($_.Exception.Message)"
    exit 1
}
