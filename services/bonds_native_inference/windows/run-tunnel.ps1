param()

$ErrorActionPreference = "Stop"

$exe = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_EXE", "Machine")
$config = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_CONFIG", "Machine")
$tunnel = [Environment]::GetEnvironmentVariable("BONDS_CLOUDFLARED_TUNNEL", "Machine")
$stateDir = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_STATE_DIR", "Machine")

if ([string]::IsNullOrWhiteSpace($stateDir)) {
    $stateDir = Join-Path $env:ProgramData "BondsNative"
}
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$logPath = Join-Path $stateDir "cloudflared.log"
$stdoutPath = Join-Path $stateDir "cloudflared.stdout.log"
$stderrPath = Join-Path $stateDir "cloudflared.stderr.log"

function Write-TunnelLog {
    param([string]$Message)
    Add-Content -LiteralPath $logPath -Value ("{0:o} {1}" -f (Get-Date), $Message)
}

if ([string]::IsNullOrWhiteSpace($exe)) { throw "BONDS_CLOUDFLARED_EXE is not configured." }
if ([string]::IsNullOrWhiteSpace($config)) { throw "BONDS_CLOUDFLARED_CONFIG is not configured." }
if ([string]::IsNullOrWhiteSpace($tunnel)) { throw "BONDS_CLOUDFLARED_TUNNEL is not configured." }
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "cloudflared executable not found: $exe" }
if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { throw "cloudflared config not found: $config" }

Write-TunnelLog "starting tunnel $tunnel"

$extension = [IO.Path]::GetExtension($exe).ToLowerInvariant()
if ($extension -eq ".ps1") {
    $psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $exe, "tunnel", "--config", $config, "run", $tunnel)
    $process = Start-Process -FilePath $psExe -ArgumentList $args -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -Wait
}
elseif ($extension -eq ".cmd" -or $extension -eq ".bat") {
    $cmdArgs = '/d /s /c ""{0}" tunnel --config "{1}" run "{2}""' -f $exe, $config, $tunnel
    $process = Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList $cmdArgs -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -Wait
}
else {
    $args = @("tunnel", "--config", $config, "run", $tunnel)
    $process = Start-Process -FilePath $exe -ArgumentList $args -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -Wait
}

$code = $process.ExitCode
Write-TunnelLog "tunnel exited $code"
exit $code
