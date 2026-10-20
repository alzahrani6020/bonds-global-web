param(
    [switch]$Activate,
    [int]$HealthTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$serviceName = "BondsTokenRuntimeService"
$serviceRegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

function Assert-FullyQualifiedPath([string]$Path, [string]$Name) {
    $windowsPath = if ($null -eq $Path) { "" } else { $Path.Replace('/', '\') }
    $qualified = $windowsPath -match '^[A-Za-z]:\\' -or $windowsPath -match '^\\\\(?![?.]\\)[^\\/:]+\\[^\\/:]+(?:\\|$)'
    if ([string]::IsNullOrWhiteSpace($Path) -or $Path -ne $Path.Trim() -or -not $qualified) {
        throw "$Name must be a fully qualified Windows file-system path. Relative, drive-relative and root-relative paths are refused."
    }
}

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $env:ProgramData "BondsTokenRuntime"
$runtimeDir = Join-Path $stateDir "runtime"
$serviceHost = Join-Path $runtimeDir "token_service.py"
$runtimeFiles = @("bonds_security\__init__.py", "bonds_security\server.py", "bonds_security\token_engine.py", "contract.json", "token_service.py")
Assert-FullyQualifiedPath $sourceRoot "Runtime source directory"
Assert-FullyQualifiedPath $runtimeDir "Runtime directory"
Assert-FullyQualifiedPath $stateDir "Runtime state directory"
$gitExe = [string](Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$pythonExe = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_PYTHON_EXE", "Machine")
if (-not [string]::IsNullOrWhiteSpace($pythonExe)) { Assert-FullyQualifiedPath $pythonExe "BONDS_TOKEN_PYTHON_EXE" }
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [Environment]::GetEnvironmentVariable("BONDS_PYTHON_EXE", "Machine")
    if (-not [string]::IsNullOrWhiteSpace($pythonExe)) { Assert-FullyQualifiedPath $pythonExe "BONDS_PYTHON_EXE" }
}
if ([string]::IsNullOrWhiteSpace($pythonExe) -or -not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    $pythonExe = [string](Get-Command python -ErrorAction Stop).Source
}
Assert-FullyQualifiedPath $pythonExe "Selected Python interpreter"

$db = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_DB", "Machine")
$secret = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_ADMIN_SECRET_FILE", "Machine")
$channelFile = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_CHANNEL_SECRET_FILE", "Machine")
$build = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", "Machine")
$port = [Environment]::GetEnvironmentVariable("BONDS_TOKEN_PORT", "Machine")
if ([string]::IsNullOrWhiteSpace($db)) {
    throw "Machine-level BONDS_TOKEN_DB is required. Refusing to select a replacement token store."
}
Assert-FullyQualifiedPath $db "BONDS_TOKEN_DB"
Assert-FullyQualifiedPath $secret "BONDS_TOKEN_ADMIN_SECRET_FILE"
Assert-FullyQualifiedPath $channelFile "BONDS_TOKEN_CHANNEL_SECRET_FILE"
foreach ($path in @($secret, $channelFile)) {
    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Existing machine-level admin and channel secret files are required. No credentials will be generated or rotated."
    }
}
if ($build -cnotmatch '^[0-9a-fA-F]{40}$') {
    throw "Machine-level BONDS_TOKEN_BUILD_COMMIT must be an exact 40-character Git SHA."
}
$build = $build.ToLowerInvariant()
if (-not [string]::IsNullOrWhiteSpace($port) -and $port -ne "8771") {
    throw "The Windows service contract requires port 8771."
}

$probe = & $pythonExe -B -c "import win32serviceutil" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "pywin32 is unavailable for the selected Python."
}

$serviceEnvironment = @(
    "BONDS_TOKEN_DB=$db",
    "BONDS_TOKEN_ADMIN_SECRET_FILE=$secret",
    "BONDS_TOKEN_CHANNEL_SECRET_FILE=$channelFile",
    "BONDS_TOKEN_BUILD_COMMIT=$build",
    "BONDS_TOKEN_PORT=8771",
    "BONDS_TOKEN_RUNTIME_ROOT=$runtimeDir",
    "BONDS_TOKEN_STATE_DIR=$stateDir",
    "BONDS_TOKEN_PYTHON_EXE=$pythonExe"
)

function Read-EnvironmentMap([string[]]$Values) {
    $result = @{}
    foreach ($value in $Values) {
        $parts = $value -split '=', 2
        if ($parts.Count -ne 2 -or [string]::IsNullOrWhiteSpace($parts[0]) -or
            $parts[0] -cne $parts[0].Trim() -or $parts[0] -match '[\x00-\x1f\x7f]' -or
            $value.IndexOf([char]0) -ge 0) {
            throw "The previous service environment contains a malformed entry; reversible cutover is unavailable."
        }
        if ($result.ContainsKey($parts[0])) {
            throw "The previous service environment contains a duplicate name; refusing ambiguous launch configuration."
        }
        $result[$parts[0]] = $parts[1]
    }
    return $result
}

function Assert-CacheConfiguration([hashtable]$ServiceConfiguration = @{}) {
    foreach ($scope in @("Machine", "User", "Process")) {
        if (-not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable("PYTHONPYCACHEPREFIX", $scope))) {
            throw "PYTHONPYCACHEPREFIX is configured at $scope scope. External bytecode caches cannot be proved or changed by this rollout."
        }
    }
    if (-not [string]::IsNullOrEmpty([string]$ServiceConfiguration["PYTHONPYCACHEPREFIX"])) {
        throw "The previous service configures PYTHONPYCACHEPREFIX; its bytecode cache location is outside the managed contract."
    }
    # This also detects a prefix introduced by the interpreter's startup setup.
    # -B alone only prevents writes; it does not prevent reading stale bytecode.
    $cacheProbe = & $pythonExe -B -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) and sys.pycache_prefix is None else 1)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python 3.10+ with the default bytecode cache location must be proved before rollout."
    }
}

function Assert-NoCacheLaunchOptions([string]$CommandLine) {
    if ($CommandLine -match '(?i)pycache_prefix|PYTHONPYCACHEPREFIX') {
        throw "A recorded or running launcher redirects Python bytecode caches; this rollout cannot prove that cache configuration."
    }
}

function Assert-NoReparseAncestors([string]$Path) {
    $current = [IO.Path]::GetFullPath($Path)
    while (-not [string]::IsNullOrEmpty($current)) {
        try {
            $attributes = [IO.File]::GetAttributes($current)
            if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "A managed runtime/cache path traverses a reparse point; refusing to change files outside its proved location."
            }
        } catch [IO.FileNotFoundException] {
            # A new runtime/cache path is permitted; its existing parents are checked.
        } catch [IO.DirectoryNotFoundException] {
        }
        $parent = [IO.Directory]::GetParent($current)
        $current = if ($null -eq $parent) { "" } else { $parent.FullName }
    }
}

function Get-ManagedBytecodeFiles {
    $result = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in $runtimeFiles) {
        if ([IO.Path]::GetExtension($file) -ne ".py") { continue }
        $source = Join-Path $runtimeDir $file
        Assert-NoReparseAncestors $source
        foreach ($extension in @(".pyc", ".pyo")) {
            $legacy = [IO.Path]::ChangeExtension($source, $extension)
            Assert-NoReparseAncestors $legacy
            if ([IO.File]::Exists($legacy)) { [void]$result.Add($legacy) }
        }
        $cacheDirectory = Join-Path ([IO.Path]::GetDirectoryName($source)) "__pycache__"
        Assert-NoReparseAncestors $cacheDirectory
        if (-not [IO.Directory]::Exists($cacheDirectory)) { continue }
        $stem = [IO.Path]::GetFileNameWithoutExtension($source)
        foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($cacheDirectory)) {
            if ([IO.Path]::GetFileName($entry) -notlike "$stem.*.pyc") { continue }
            Assert-NoReparseAncestors $entry
            if (-not [IO.File]::Exists($entry)) {
                throw "A managed bytecode entry is not a regular file; refusing broad cache cleanup."
            }
            [void]$result.Add($entry)
        }
    }
    return @($result)
}

function Clear-ManagedRuntimeBytecode {
    if (Test-ManagedServiceExists) {
        $frozen = Invoke-StartupConfiguration "inspect"
        if ($frozen.startType -ne 4 -or $frozen.serviceState -ne 1) {
            throw "Bytecode invalidation requires the managed service to be disabled and stopped."
        }
    } elseif ($existing -or (Test-Path -LiteralPath $serviceRegistryPath -ErrorAction Stop)) {
        throw "The runtime's service registration is not proved absent; bytecode invalidation is blocked."
    }
    if (@(Get-TokenListeners).Count -ne 0) { throw "A live token listener prevents bytecode invalidation." }
    foreach ($file in @(Get-ManagedBytecodeFiles)) {
        # Delete only caches of the four managed Python sources, including every
        # optimization/cache tag. Preserve all other files and directories.
        [IO.File]::Delete($file)
    }
    if (@(Get-ManagedBytecodeFiles).Count -ne 0) {
        throw "Managed bytecode caches remain; refusing to import or start unproved runtime code."
    }
}

function Get-SourcePath([string]$File) {
    if ($File -eq "token_service.py") { return Join-Path $PSScriptRoot $File }
    return Join-Path $sourceRoot $File
}

function Assert-SourceIdentity {
    $headOutput = @(& $gitExe --no-optional-locks -C $sourceRoot rev-parse --verify HEAD 2>&1)
    if ($LASTEXITCODE -ne 0 -or $headOutput.Count -ne 1) {
        throw "Cannot resolve the runtime checkout's Git HEAD; source identity is unproved."
    }
    $head = ([string]$headOutput[0]).Trim().ToLowerInvariant()
    if ($head -cnotmatch '^[0-9a-f]{40}$' -or $head -cne $build) {
        throw "BONDS_TOKEN_BUILD_COMMIT does not match the runtime checkout's actual Git HEAD."
    }
    $sourceDiff = @(& $gitExe --no-optional-locks -C $sourceRoot diff --no-ext-diff --no-textconv --exit-code HEAD -- . 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Runtime source differs from HEAD, or Git could not verify it; refusing rollout." }
    $sourceStatus = @(& $gitExe --no-optional-locks -C $sourceRoot status --porcelain=v1 --untracked-files=all -- . 2>&1)
    if ($LASTEXITCODE -ne 0 -or $sourceStatus.Count -ne 0) {
        throw "The runtime directory has uncommitted/untracked changes, or Git status failed; refusing rollout."
    }
    foreach ($file in $runtimeFiles) {
        $gitPath = if ($file -eq "token_service.py") { "windows/token_service.py" } else { $file.Replace('\', '/') }
        $tracked = @(& $gitExe --no-optional-locks -C $sourceRoot ls-files --error-unmatch -- $gitPath 2>&1)
        if ($LASTEXITCODE -ne 0 -or $tracked.Count -ne 1) {
            throw "A runtime source file is not tracked by the verified checkout: $gitPath"
        }
    }
}

function Assert-ServiceRegistration {
    $imagePath = [string](Get-ItemPropertyValue -Path $serviceRegistryPath -Name "ImagePath" -ErrorAction Stop)
    $pythonClass = [string](Get-Item -LiteralPath "$serviceRegistryPath\PythonClass" -ErrorAction Stop).GetValue("")
    if ($imagePath -cne $previousImagePath -or $pythonClass -cne $previousPythonClass) {
        throw "The service's ImagePath/PythonClass changed; its recorded launch configuration is no longer proved."
    }
}

function Set-ServiceEnvironment([string[]]$Values) {
    if ($null -ne (Get-ItemProperty -Path $serviceRegistryPath -Name "Environment" -ErrorAction SilentlyContinue)) {
        Set-ItemProperty -Path $serviceRegistryPath -Name "Environment" -Value $Values
    } else {
        New-ItemProperty -Path $serviceRegistryPath -Name "Environment" -PropertyType MultiString -Value $Values | Out-Null
    }
}

function Get-TokenListeners {
    # A failed inventory must not look like a free port.
    return @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 8771 })
}

function Test-ManagedServiceExists {
    # Enumeration errors are failures, not evidence that registration is absent.
    $controllers = @(Get-Service -ErrorAction Stop)
    try {
        return $controllers.Name -contains $serviceName
    } finally {
        # An open ServiceController can itself keep deletion pending.
        foreach ($controller in $controllers) { $controller.Dispose() }
    }
}

function Invoke-StartupConfiguration([string]$Action, [int]$StartType = 0, [bool]$DelayedAutoStart = $false) {
    $startupCode = @'
import json, sys, time, win32service
name, action = sys.argv[1:3]
manager = win32service.OpenSCManager(None, None, win32service.SC_MANAGER_CONNECT)
try:
    rights = (win32service.SERVICE_QUERY_CONFIG | win32service.SERVICE_QUERY_STATUS |
              win32service.SERVICE_CHANGE_CONFIG | win32service.SERVICE_START | win32service.SERVICE_STOP)
    service = win32service.OpenService(manager, name, rights)
    try:
        if action in ('freeze', 'restore'):
            start_type = win32service.SERVICE_DISABLED if action == 'freeze' else int(sys.argv[3])
            delayed = sys.argv[4] == 'true'
            if start_type not in (win32service.SERVICE_AUTO_START, win32service.SERVICE_DEMAND_START, win32service.SERVICE_DISABLED):
                raise RuntimeError('Unsupported service startup baseline')
            win32service.ChangeServiceConfig(service, win32service.SERVICE_NO_CHANGE, start_type,
                win32service.SERVICE_NO_CHANGE, None, None, 0, None, None, None, None)
            if action == 'restore' and start_type == win32service.SERVICE_AUTO_START:
                win32service.ChangeServiceConfig2(service, win32service.SERVICE_CONFIG_DELAYED_AUTO_START_INFO, delayed)
            if action == 'freeze':
                state = win32service.QueryServiceStatus(service)[1]
                if state not in (win32service.SERVICE_STOPPED, win32service.SERVICE_STOP_PENDING):
                    win32service.ControlService(service, win32service.SERVICE_CONTROL_STOP)
                deadline = time.monotonic() + 30
                while win32service.QueryServiceStatus(service)[1] != win32service.SERVICE_STOPPED:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Service did not stop while startup was disabled')
                    time.sleep(0.1)
        elif action != 'inspect':
            raise RuntimeError('Unsupported startup operation')
        result = {
            'startType': win32service.QueryServiceConfig(service)[1],
            'delayedAutoStart': bool(win32service.QueryServiceConfig2(service, win32service.SERVICE_CONFIG_DELAYED_AUTO_START_INFO)),
            'serviceState': win32service.QueryServiceStatus(service)[1],
        }
        if action in ('freeze', 'restore') and result['startType'] != start_type:
            raise RuntimeError('Service startup configuration did not match the requested state')
        if action == 'restore' and result['delayedAutoStart'] != delayed:
            raise RuntimeError('Service delayed-auto configuration was not restored')
        if action == 'freeze' and result['serviceState'] != win32service.SERVICE_STOPPED:
            raise RuntimeError('Service is not stopped; source must not be changed')
        print(json.dumps(result))
    finally:
        win32service.CloseServiceHandle(service)
finally:
    win32service.CloseServiceHandle(manager)
'@
    $startupArguments = @("-B", "-c", $startupCode, $serviceName, $Action, [string]$StartType, ([string]$DelayedAutoStart).ToLowerInvariant())
    $startupOutput = @(& $pythonExe @startupArguments 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "SCM startup operation '$Action' failed; a stopped/disabled recovery state is not guaranteed." }
    return ($startupOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
}

function Freeze-ManagedService {
    $frozen = Invoke-StartupConfiguration "freeze"
    if ($frozen.startType -ne 4 -or $frozen.serviceState -ne 1 -or @(Get-TokenListeners).Count -ne 0) {
        throw "Service is not proved disabled, stopped and free of its listener; source/configuration changes are blocked."
    }
}

function Restore-ServiceStartup($Configuration) {
    Invoke-StartupConfiguration "restore" ([int]$Configuration.startType) ([bool]$Configuration.delayedAutoStart) | Out-Null
}

function Get-Health([string]$SecretPath) {
    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($SecretPath)) {
        $headers["X-Bonds-Channel"] = [IO.File]::ReadAllText($SecretPath).Trim()
    }
    return Invoke-RestMethod -Uri "http://127.0.0.1:8771/health" -Headers $headers -TimeoutSec 5 -MaximumRedirection 0
}

function Test-Health([string]$ExpectedBuild, [string]$SecretPath, [bool]$RequireChannelContract = $true) {
    try {
        $health = Get-Health $SecretPath
        $valid = ($health.status -ceq "ok" -and $health.service -ceq "bonds-token-service" -and
            $health.build_commit -ceq $ExpectedBuild -and $health.schema_version -eq 2 -and
            $health.service_token_ttl_seconds -eq 3600)
        if ($RequireChannelContract) {
            $valid = ($valid -and $health.issuer -ceq "bonds-token-service" -and
                $health.contract_version -eq 1 -and $health.channel_auth -ceq "required")
        }
        return $valid
    } catch { return $false }
}

function Ensure-Directory([string]$Path) {
    [IO.Directory]::CreateDirectory($Path) | Out-Null
}

function Copy-Runtime([string]$From, [string]$To) {
    Ensure-Directory (Join-Path $To "bonds_security")
    foreach ($file in $runtimeFiles) {
        Copy-Item -LiteralPath (Join-Path $From $file) -Destination (Join-Path $To $file)
    }
}

# All configuration, source, listener and rollback checks precede any service or
# runtime mutation. The validator does not open the token database or a socket.
Assert-CacheConfiguration
Get-ManagedBytecodeFiles | Out-Null
Assert-SourceIdentity
$sourceHashes = @{}
foreach ($file in $runtimeFiles) {
    $source = Get-SourcePath $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Runtime source is incomplete: $file" }
    $sourceHashes[$file] = (Get-FileHash -LiteralPath $source -Algorithm SHA256 -ErrorAction Stop).Hash
}
$priorProcessEnvironment = @{}
try {
    foreach ($entry in $serviceEnvironment) {
        $parts = $entry -split '=', 2
        $priorProcessEnvironment[$parts[0]] = [Environment]::GetEnvironmentVariable($parts[0], "Process")
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
    Push-Location $sourceRoot
    try {
        # An ignored checkout __pycache__ can survive a commit switch with the
        # same source size/mtime. A fresh, unwritten prefix excludes those caches
        # without deleting or writing anything in the source checkout.
        $preflightCachePrefix = Join-Path $stateDir ("preflight-bytecode-" + [Guid]::NewGuid().ToString("N"))
        Assert-NoReparseAncestors $preflightCachePrefix
        if (Test-Path -LiteralPath $preflightCachePrefix -ErrorAction Stop) { throw "Preflight cache prefix already exists." }
        $configurationCode = @'
import runpy, sys
if sys.pycache_prefix != sys.argv[1] or not sys.dont_write_bytecode:
    raise RuntimeError('Read-only source preflight cache isolation was not established')
sys.argv = ['bonds_security.server', '--check-config']
runpy.run_module('bonds_security.server', run_name='__main__')
'@
        $configurationCheck = & $pythonExe -B -X "pycache_prefix=$preflightCachePrefix" -c $configurationCode $preflightCachePrefix 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Token runtime configuration preflight failed; existing service is unchanged." }
        if (Test-Path -LiteralPath $preflightCachePrefix -ErrorAction Stop) {
            throw "The supposedly read-only preflight wrote a bytecode cache; source validation is not proved."
        }
    } finally { Pop-Location }
} finally {
    foreach ($name in $priorProcessEnvironment.Keys) {
        if ($null -eq $priorProcessEnvironment[$name]) {
            # PowerShell converts ordinary $null to an empty .NET string here.
            # Preserve absence instead of leaving a newly empty environment entry.
            [Environment]::SetEnvironmentVariable($name, [System.Management.Automation.Language.NullString]::Value, "Process")
        } else {
            [Environment]::SetEnvironmentVariable($name, $priorProcessEnvironment[$name], "Process")
        }
        if ([Environment]::GetEnvironmentVariable($name, "Process") -cne $priorProcessEnvironment[$name]) {
            throw "Runtime preflight could not restore a process environment entry to its previous value or absence."
        }
    }
}

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
$wasRunning = $existing -and $existing.Status -eq "Running"
$previousEnvironment = @()
$previousConfig = @{}
$previousRequiresChannel = $false
$previousBuild = ""
$previousImagePath = ""
$previousPythonClass = ""
$previousStartup = $null
$activationStartup = $null
if (-not $existing) {
    foreach ($file in $runtimeFiles) {
        if (Test-Path -LiteralPath (Join-Path $runtimeDir $file)) {
            throw "Unmanaged runtime source already exists. Establish its recovery configuration before overwriting it."
        }
    }
}
if ($existing) {
    if ($existing.Status -ne "Running") {
        throw "Existing-service rollout requires a running, healthy recovery baseline. A stopped or transitioning baseline cannot safely regain enabled startup after a queued candidate restart."
    }
    $previousImagePath = [string](Get-ItemPropertyValue -Path $serviceRegistryPath -Name "ImagePath" -ErrorAction Stop)
    Assert-NoCacheLaunchOptions $previousImagePath
    $previousPythonClass = [string](Get-Item -LiteralPath "$serviceRegistryPath\PythonClass" -ErrorAction Stop).GetValue("")
    $expectedPythonClass = [IO.Path]::ChangeExtension($serviceHost, [System.Management.Automation.Language.NullString]::Value) + ".BondsTokenRuntimeService"
    if ([string]::IsNullOrWhiteSpace($previousImagePath) -or $previousPythonClass -ne $expectedPythonClass) {
        throw "The existing service registration does not identify this runtime wrapper; refusing to rewrite its launch configuration."
    }
    $previousStartup = Invoke-StartupConfiguration "inspect"
    if ($previousStartup.startType -notin @(2, 3) -or
        ($previousStartup.startType -ne 2 -and $previousStartup.delayedAutoStart)) {
        throw "The current startup baseline cannot be restored before monitored startup. Disabled or inconsistent startup modes require a separate approved host procedure."
    }
    $activationStartup = $previousStartup
    $environmentKey = Get-Item -LiteralPath $serviceRegistryPath -ErrorAction Stop
    try {
        if ($environmentKey.GetValueKind("Environment") -ne [Microsoft.Win32.RegistryValueKind]::MultiString) {
            throw "The previous service environment is not REG_MULTI_SZ; its launch configuration is unproved."
        }
        # Get-ItemPropertyValue emits REG_MULTI_SZ as one pipeline object; @()
        # would nest that string[] and join its entries when converted to string.
        $storedEnvironment = $environmentKey.GetValue("Environment", $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($storedEnvironment -isnot [string[]]) {
            throw "The previous service environment did not return a native string array; refusing cutover."
        }
        $previousEnvironment = [string[]]$storedEnvironment
    } finally {
        $environmentKey.Dispose()
    }
    $previousConfig = Read-EnvironmentMap $previousEnvironment
    Assert-CacheConfiguration $previousConfig
    foreach ($name in @("BONDS_TOKEN_DB", "BONDS_TOKEN_ADMIN_SECRET_FILE", "BONDS_TOKEN_BUILD_COMMIT", "BONDS_TOKEN_RUNTIME_ROOT", "BONDS_TOKEN_STATE_DIR", "BONDS_TOKEN_PYTHON_EXE", "BONDS_TOKEN_PORT")) {
        if ([string]::IsNullOrWhiteSpace($previousConfig[$name])) { throw "Previous service configuration is incomplete; refusing cutover." }
    }
    foreach ($name in @("BONDS_TOKEN_DB", "BONDS_TOKEN_ADMIN_SECRET_FILE", "BONDS_TOKEN_RUNTIME_ROOT", "BONDS_TOKEN_STATE_DIR", "BONDS_TOKEN_PYTHON_EXE")) {
        Assert-FullyQualifiedPath $previousConfig[$name] "Previous $name"
    }
    if (-not [string]::IsNullOrWhiteSpace($previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE)) {
        Assert-FullyQualifiedPath $previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE "Previous BONDS_TOKEN_CHANNEL_SECRET_FILE"
    }
    if ([IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_DB) -ne [IO.Path]::GetFullPath($db) -or
        [IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_RUNTIME_ROOT) -ne [IO.Path]::GetFullPath($runtimeDir) -or
        [IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_STATE_DIR) -ne [IO.Path]::GetFullPath($stateDir) -or
        [IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_PYTHON_EXE) -ne [IO.Path]::GetFullPath($pythonExe) -or
        [IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_ADMIN_SECRET_FILE) -ne [IO.Path]::GetFullPath($secret) -or
        $previousConfig.BONDS_TOKEN_PORT -ne "8771") {
        throw "Database, admin credential path, runtime/state directories, interpreter and port must match the existing service for reversible cutover."
    }
    if (-not [string]::IsNullOrWhiteSpace($previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE) -and
        [IO.Path]::GetFullPath($previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE) -ne [IO.Path]::GetFullPath($channelFile)) {
        throw "An existing channel credential path must remain unchanged; credential rotation is outside this rollout."
    }
    if (-not (Test-Path -LiteralPath $db -PathType Leaf) -or
        -not (Test-Path -LiteralPath $previousConfig.BONDS_TOKEN_ADMIN_SECRET_FILE -PathType Leaf)) {
        throw "The previous service store or secret file is unavailable; refusing cutover."
    }
    foreach ($file in $runtimeFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $runtimeDir $file) -PathType Leaf)) { throw "Previous source is incomplete; rollback is unavailable." }
    }
    $previousBuild = $previousConfig.BONDS_TOKEN_BUILD_COMMIT
    if ($previousBuild -cnotmatch '^[0-9a-fA-F]{40}$') { throw "Previous build identity is not an exact Git SHA; refusing cutover." }
}

$listeners = @(Get-TokenListeners)
if ($listeners.Count -gt 0) {
    if (-not $wasRunning -or $listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne "127.0.0.1") {
        throw "Port 8771 is not exclusively owned by the managed loopback service. Legacy cutover requires a verified host maintenance procedure."
    }
    $serviceProcess = Get-CimInstance Win32_Service -Filter "Name = '$serviceName'"
    $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0].OwningProcess)"
    Assert-NoCacheLaunchOptions $listenerProcess.CommandLine
    if (-not $listenerProcess -or $listenerProcess.ParentProcessId -ne $serviceProcess.ProcessId -or
        $listenerProcess.CommandLine -notmatch '(?:^|\s)-m\s+bonds_security\.server(?:\s|$)' -or
        [IO.Path]::GetFullPath($listenerProcess.ExecutablePath) -ne [IO.Path]::GetFullPath($pythonExe)) {
        throw "The listener's ownership and launch configuration could not be proved; no process will be stopped."
    }
    $previousHealth = Get-Health $previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE
    $previousRequiresChannel = $previousHealth.channel_auth -ceq "required"
    if (-not (Test-Health $previousBuild $previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE $previousRequiresChannel)) {
        throw "The currently running service does not match its recorded identity and contract; refusing cutover."
    }
} elseif ($wasRunning) {
    throw "The running service has no healthy loopback listener; automated rollout cannot establish a recovery baseline."
}

if (-not $Activate) {
    Write-Host "Preflight passed. Runtime files, service configuration and running processes are unchanged."
    Write-Host "Run with -Activate in the approved host window to back up state and perform the health-checked cutover."
    exit 0
}

# Retain a unique source snapshot and a consistent SQLite backup. Never restore
# this older database automatically: doing so could resurrect revoked tokens.
Ensure-Directory $stateDir
$snapshotDir = Join-Path $stateDir ("runtime-rollback-" + [DateTime]::UtcNow.ToString("yyyyMMddTHHmmss") + "-" + [Guid]::NewGuid().ToString("N"))
Ensure-Directory $snapshotDir
if ($existing) {
    Copy-Runtime $runtimeDir (Join-Path $snapshotDir "runtime")
    # Persist only this service's known paths/identity, never secret contents or
    # arbitrary environment variables, for recovery after an interrupted shell.
    $recordedConfiguration = @{}
    foreach ($entry in $serviceEnvironment) {
        $name = ($entry -split '=', 2)[0]
        if ($previousConfig.ContainsKey($name)) { $recordedConfiguration[$name] = $previousConfig[$name] }
    }
    @{ wasRunning = [bool]$wasRunning; configuration = $recordedConfiguration;
        imagePath = $previousImagePath; pythonClass = $previousPythonClass; startup = $previousStartup } |
        ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $snapshotDir "previous-config.json") -Encoding UTF8
}
if (Test-Path -LiteralPath $db -PathType Leaf) {
    $backupCode = @'
import pathlib, sqlite3, sys
from contextlib import closing
source_uri = pathlib.Path(sys.argv[1]).resolve().as_uri() + '?mode=ro'
with closing(sqlite3.connect(source_uri, uri=True)) as source, closing(sqlite3.connect(sys.argv[2])) as backup:
    source.backup(backup)
    if backup.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        raise RuntimeError('Token database backup did not pass integrity validation')
'@
    $backupCheck = & $pythonExe -B -c $backupCode $db (Join-Path $snapshotDir "tokens.sqlite3.backup") 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Database backup failed; existing service is unchanged." }
}

$installedNewService = $false
$cutoverStarted = $false
try {
    Assert-CacheConfiguration $previousConfig
    Assert-SourceIdentity
    foreach ($file in $runtimeFiles) {
        if ((Get-FileHash -LiteralPath (Get-SourcePath $file) -Algorithm SHA256 -ErrorAction Stop).Hash -cne $sourceHashes[$file]) {
            throw "Runtime source changed after preflight; cutover was cancelled."
        }
    }
    if ($existing) {
        Assert-ServiceRegistration
        $currentStartup = Invoke-StartupConfiguration "inspect"
        if ($currentStartup.startType -ne $previousStartup.startType -or $currentStartup.delayedAutoStart -ne $previousStartup.delayedAutoStart) {
            throw "Service startup settings changed after preflight; cutover was cancelled."
        }
    } elseif ((Test-ManagedServiceExists) -or (Test-Path -LiteralPath $serviceRegistryPath -ErrorAction Stop)) {
        throw "A service registration appeared after preflight; refusing to take it over."
    }
    if ($wasRunning) {
        $currentListeners = @(Get-TokenListeners)
        if ($currentListeners.Count -ne 1 -or $currentListeners[0].OwningProcess -ne $listeners[0].OwningProcess -or
            -not (Test-Health $previousBuild $previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE $previousRequiresChannel)) {
            throw "The previous service changed after preflight; cutover was cancelled."
        }
    }
    $cutoverStarted = $true
    if ($existing) { Freeze-ManagedService }
    if (@(Get-TokenListeners).Count -gt 0) {
        throw "Port 8771 is still occupied after the managed service stop; refusing to replace source."
    }
    Ensure-Directory (Join-Path $runtimeDir "bonds_security")
    foreach ($file in $runtimeFiles) {
        $destination = Join-Path $runtimeDir $file
        Copy-Item -LiteralPath (Get-SourcePath $file) -Destination $destination
        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256 -ErrorAction Stop).Hash -cne $sourceHashes[$file]) {
            throw "A copied runtime file does not match the verified source; refusing startup."
        }
    }
    Clear-ManagedRuntimeBytecode
    if (-not $existing) {
        & $pythonExe $serviceHost --startup auto install
        $serviceUpdateExit = $LASTEXITCODE
        $installedNewService = Test-ManagedServiceExists
        if ($serviceUpdateExit -ne 0) { throw "Failed to install the managed service." }
        if (-not $installedNewService -or -not (Test-Path -LiteralPath $serviceRegistryPath -ErrorAction Stop)) {
            throw "Install completed without a verified SCM service registration; refusing startup."
        }
        $activationStartup = Invoke-StartupConfiguration "inspect"
        if ($activationStartup.startType -ne 2 -or $activationStartup.delayedAutoStart) {
            throw "The newly installed service does not match the requested automatic startup baseline."
        }
        Freeze-ManagedService
    }
    # The existing interpreter, wrapper class and SCM registration are retained;
    # invoking pywin32 update would unnecessarily rewrite ImagePath/PythonClass.
    if ($existing) { Assert-ServiceRegistration }
    if (-not $existing) {
        & sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to configure service recovery." }
        & sc.exe failureflag $serviceName 1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to configure service recovery flag." }
    }
    Set-ServiceEnvironment $serviceEnvironment
    Restore-ServiceStartup $activationStartup
    Start-Service -Name $serviceName
    $deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        if (Test-Health $build $channelFile) { $healthy = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $healthy) { throw "The new service did not pass authenticated identity/contract readiness." }
    Write-Host "BondsTokenRuntimeService passed authenticated readiness for build $build. Recovery snapshot: $snapshotDir"
    Write-Host "Capability acceptance and production restart/revocation evidence are still required."
} catch {
    $cutoverError = $_.Exception.Message
    if (-not $cutoverStarted) { throw $cutoverError }
    try {
        if (Test-ManagedServiceExists) {
            # A queued SCM recovery action can outlive Stop-Service. Disable
            # startup and prove STOPPED before restoring even the first file.
            Freeze-ManagedService
        } elseif ($existing -or @(Get-TokenListeners).Count -ne 0) {
            throw "The managed recovery baseline is unavailable; source/configuration restoration is blocked."
        }
        if ($existing) {
            Copy-Runtime (Join-Path $snapshotDir "runtime") $runtimeDir
            Clear-ManagedRuntimeBytecode
            Set-ServiceEnvironment $previousEnvironment
            Assert-ServiceRegistration
            # Keep the same database, including revocations committed after backup.
            Restore-ServiceStartup $previousStartup
            if ($wasRunning) {
                Start-Service -Name $serviceName
                $deadline = (Get-Date).AddSeconds([Math]::Max(15, $HealthTimeoutSeconds))
                $recovered = $false
                while ((Get-Date) -lt $deadline) {
                    if (Test-Health $previousBuild $previousConfig.BONDS_TOKEN_CHANNEL_SECRET_FILE $previousRequiresChannel) { $recovered = $true; break }
                    Start-Sleep -Seconds 1
                }
                if (-not $recovered) { throw "The restored runtime did not pass its previous identity/contract check." }
            }
        } elseif ($installedNewService) {
            & $pythonExe $serviceHost remove
            if ($LASTEXITCODE -ne 0) { throw "Could not remove the newly installed failed service." }
        }
        if (-not $existing) {
            if ((Test-ManagedServiceExists) -or (Test-Path -LiteralPath $serviceRegistryPath -ErrorAction Stop)) {
                throw "Service registration remains or deletion is pending. Automatic recovery is blocked; new runtime files are retained."
            }
            Clear-ManagedRuntimeBytecode
            # Preflight proved these files were absent before this attempt.
            foreach ($file in $runtimeFiles) {
                $createdFile = Join-Path $runtimeDir $file
                if (Test-Path -LiteralPath $createdFile -PathType Leaf) { Remove-Item -LiteralPath $createdFile }
            }
        }
    } catch {
        $recoveryError = $_.Exception.Message
        try {
            if (Test-ManagedServiceExists) { Freeze-ManagedService }
        } catch {
            throw "Runtime rollout/recovery failed and disabled/stopped state could not be guaranteed. No further source restoration was attempted. Database and snapshot retained: $snapshotDir. $recoveryError"
        }
        throw "Runtime rollout failed and automatic source/configuration recovery failed. The service was left disabled/stopped when present. Database and snapshot retained: $snapshotDir. $recoveryError"
    }
    throw "Runtime rollout failed; previous source/configuration was restored with the current database retained. $cutoverError"
}
