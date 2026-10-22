#requires -Version 7.2
[CmdletBinding()]
param()

# This test owns a fresh GitHub-hosted Windows VM's otherwise absent token
# service. It never runs against an existing installation or a production host.
# The only broken source is a local commit in a temporary checkout.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$serviceName = "BondsTokenRuntimeService"
$serviceRegistry = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
$script:activeChildren = [Collections.Generic.List[Diagnostics.Process]]::new()
$script:client = $null
$script:report = $null
$script:reportPath = $null
$script:currentCase = "isolation_guards"

function Assert-Acceptance([bool]$Condition, [string]$Code) {
    if (-not $Condition) { throw "BONDS_ACCEPTANCE_$Code" }
}

function Get-SafeFailure($Failure) {
    $message = [string]$Failure.Exception.Message
    if ($message -cmatch '^BONDS_ACCEPTANCE_[A-Z0-9_]+$') { return $message }
    return "BONDS_ACCEPTANCE_UNEXPECTED_" + $Failure.Exception.GetType().Name.ToUpperInvariant()
}

function Get-TextHash([string]$Text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
}

function Write-Report {
    if ($null -ne $script:report -and $null -ne $script:reportPath) {
        [IO.File]::WriteAllText($script:reportPath,
            ($script:report | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    }
}

function Invoke-Case([string]$Name, [scriptblock]$Action) {
    $script:currentCase = $Name
    try {
        $details = & $Action
        $entry = [ordered]@{ name = $Name; status = "PASS" }
        if ($null -ne $details) { $entry["evidence"] = $details }
        $script:report.cases.Add($entry)
        Write-Report
    } catch {
        $script:report.cases.Add([ordered]@{
            name = $Name; status = "FAIL"; code = Get-SafeFailure $_
        })
        Write-Report
        throw
    }
}

function Get-ServiceSnapshot {
    $controllers = @(Get-Service -ErrorAction Stop)
    try {
        $match = @($controllers | Where-Object { $_.Name -ceq $serviceName })
        Assert-Acceptance ($match.Count -le 1) "DUPLICATE_SERVICE"
        if ($match.Count -eq 0) { return @{ exists = $false; status = "Absent" } }
        return @{ exists = $true; status = [string]$match[0].Status }
    } finally {
        foreach ($controller in $controllers) { $controller.Dispose() }
    }
}

function Get-TokenListeners {
    return @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq 8771 })
}

function Assert-AbsentRuntime {
    Assert-Acceptance (-not (Get-ServiceSnapshot).exists) "EXISTING_SERVICE"
    Assert-Acceptance (-not (Test-Path -LiteralPath $serviceRegistry)) "EXISTING_SERVICE_REGISTRY"
    Assert-Acceptance (-not (Test-Path -LiteralPath $stateDirectory)) "EXISTING_RUNTIME_STATE"
    Assert-Acceptance (@(Get-TokenListeners).Count -eq 0) "EXISTING_PORT_8771_LISTENER"
}

function Read-ServiceEnvironment {
    # Get-ItemPropertyValue emits REG_MULTI_SZ as one pipeline object. Wrapping
    # that command in @() nests the array and can join all entries into one value.
    $key = Get-Item -LiteralPath $serviceRegistry -ErrorAction Stop
    try {
        Assert-Acceptance ($key.GetValueKind("Environment") -eq
            [Microsoft.Win32.RegistryValueKind]::MultiString) "SERVICE_ENVIRONMENT_NOT_MULTISTRING"
        $values = $key.GetValue("Environment", $null,
            [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        Assert-Acceptance ($values -is [string[]] -and $values.Count -gt 0) "SERVICE_ENVIRONMENT_INVALID"
    } finally { $key.Dispose() }
    $map = @{}
    foreach ($entry in $values) {
        $parts = ([string]$entry) -split "=", 2
        Assert-Acceptance ($parts.Count -eq 2 -and -not [string]::IsNullOrWhiteSpace($parts[0])) "MALFORMED_SERVICE_ENVIRONMENT"
        Assert-Acceptance (-not $map.ContainsKey($parts[0])) "DUPLICATE_SERVICE_ENVIRONMENT"
        $map[$parts[0]] = $parts[1]
    }
    return $map
}

function Get-ServiceRegistration {
    $key = Get-Item -LiteralPath $serviceRegistry -ErrorAction Stop
    $classKey = $null
    try {
        $classKey = Get-Item -LiteralPath "$serviceRegistry\PythonClass" -ErrorAction Stop
        return @{
            image_path = [string]$key.GetValue("ImagePath")
            python_class = [string]$classKey.GetValue("")
            start = [int]$key.GetValue("Start")
            delayed_auto_start = [bool]$key.GetValue("DelayedAutoStart", 0)
        }
    } finally {
        if ($null -ne $classKey) { $classKey.Dispose() }
        $key.Dispose()
    }
}

function Assert-OwnedService {
    Assert-Acceptance ((Get-ServiceSnapshot).exists) "OWNED_SERVICE_MISSING"
    $configuration = Read-ServiceEnvironment
    foreach ($name in @("BONDS_TOKEN_DB", "BONDS_TOKEN_ADMIN_SECRET_FILE", "BONDS_TOKEN_CHANNEL_SECRET_FILE",
        "BONDS_TOKEN_BROKER_SECRET_FILE", "BONDS_TOKEN_RUNTIME_ROOT", "BONDS_TOKEN_STATE_DIR",
        "BONDS_TOKEN_PYTHON_EXE", "BONDS_TOKEN_PORT")) {
        Assert-Acceptance ($configuration[$name] -ceq $expectedServiceEnvironment[$name]) ("SERVICE_OWNERSHIP_MISMATCH_" + $name)
    }
    $registration = Get-ServiceRegistration
    Assert-Acceptance ($registration.python_class -ceq
        ([IO.Path]::ChangeExtension($serviceHost, [System.Management.Automation.Language.NullString]::Value) + ".BondsTokenRuntimeService")) "SERVICE_CLASS_MISMATCH"
}

function Wait-ServiceState([string]$State) {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    do {
        if ((Get-ServiceSnapshot).status -ceq $State) { return }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "BONDS_ACCEPTANCE_SERVICE_STATE_TIMEOUT"
}

function Invoke-Child([string]$Executable, [string[]]$Arguments,
    [string]$WorkingDirectory = $repository, [scriptblock]$OnTick = $null) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $info.Environment.Clear()
    foreach ($name in @("PATH", "SystemRoot", "SystemDrive", "WINDIR", "COMSPEC", "PATHEXT",
        "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
        "ProgramFiles", "ProgramFiles(x86)", "CommonProgramFiles", "ProgramData", "RUNNER_TRACKING_ID")) {
        $value = [Environment]::GetEnvironmentVariable($name, "Process")
        if (-not [string]::IsNullOrEmpty($value)) { $info.Environment[$name] = $value }
    }
    $info.Environment["PYTHONDONTWRITEBYTECODE"] = "1"
    if ($null -ne $emptyGitConfig) {
        $info.Environment["GIT_CONFIG_NOSYSTEM"] = "1"
        $info.Environment["GIT_CONFIG_GLOBAL"] = $emptyGitConfig
    }
    $child = [Diagnostics.Process]::new()
    $child.StartInfo = $info
    $script:activeChildren.Add($child)
    $started = $false
    $tickFailure = $null
    try {
        $started = $child.Start()
        Assert-Acceptance $started "CHILD_START_FAILED"
        $stdout = $child.StandardOutput.ReadToEndAsync()
        $stderr = $child.StandardError.ReadToEndAsync()
        $deadline = [DateTime]::UtcNow.AddSeconds(180)
        while (-not $child.HasExited) {
            if ($null -ne $OnTick -and $null -eq $tickFailure) {
                try { & $OnTick } catch { $tickFailure = $_ }
            }
            if ([DateTime]::UtcNow -ge $deadline) {
                # Do not race a still-running installer by stopping its service
                # or deleting its files. The report remains FAIL with incomplete
                # cleanup, and the disposable CI VM must be discarded.
                throw "BONDS_ACCEPTANCE_CHILD_TIMEOUT"
            }
            Start-Sleep -Milliseconds 150
        }
        $child.WaitForExit()
        $result = @{
            exit_code = $child.ExitCode
            stdout = $stdout.GetAwaiter().GetResult()
            stderr = $stderr.GetAwaiter().GetResult()
        }
        if ($null -ne $tickFailure) { throw $tickFailure }
        return $result
    } finally {
        if (-not $started -or $child.HasExited) {
            [void]$script:activeChildren.Remove($child)
            $child.Dispose()
        }
    }
}

function Invoke-Git([string[]]$Arguments) {
    $result = Invoke-Child $gitExe $Arguments
    Assert-Acceptance ($result.exit_code -eq 0) "GIT_COMMAND_FAILED"
    return ([string]$result.stdout).Trim()
}

function Invoke-Installer([string]$Path, [scriptblock]$OnTick = $null) {
    $script:activationAttempted = $true
    return Invoke-Child $shellExe @("-NoLogo", "-NoProfile", "-NonInteractive",
        "-File", $Path, "-Activate", "-HealthTimeoutSeconds", "15") -OnTick $OnTick
}

function Send-Runtime([string]$Route, [string]$Credential = "Channel", $Body = $null) {
    Assert-Acceptance ($Route -cmatch '^/(health|issue|introspect|revoke|verify|broker/issue|broker/revoke)
    $method = if ($null -eq $Body) { [Net.Http.HttpMethod]::Get } else { [Net.Http.HttpMethod]::Post }
    $request = [Net.Http.HttpRequestMessage]::new($method, "http://127.0.0.1:8771$Route")
    $response = $null
    try {
        if ($Credential -ceq "Channel") { $request.Headers.Add("X-Bonds-Channel", $channelSecret) }
        elseif ($Credential -ceq "Admin") { $request.Headers.Add("X-Bonds-Admin", $adminSecret) }
        elseif ($Credential -ceq "Broker") { $request.Headers.Add("X-Bonds-Broker", $brokerSecret) }
        else { Assert-Acceptance ($Credential -ceq "None") "INVALID_TEST_CREDENTIAL_KIND" }
        if ($null -ne $Body) {
            $request.Content = [Net.Http.StringContent]::new(
                ($Body | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8, "application/json")
        }
        $response = $script:client.SendAsync($request).GetAwaiter().GetResult()
        $raw = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return @{ status = [int]$response.StatusCode; body = ($raw | ConvertFrom-Json -AsHashtable) }
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
}

function Assert-Identity($Identity, [string]$Build, [string]$Status = "ok") {
    Assert-Acceptance ($null -ne $Identity -and $Identity.status -ceq $Status -and
        $Identity.service -ceq "bonds-token-service" -and $Identity.issuer -ceq "bonds-token-service" -and
        $Identity.version -ceq "2.0" -and $Identity.build_commit -ceq $Build -and
        $Identity.contract_version -eq 2 -and $Identity.schema_version -eq 3 -and
        $Identity.service_token_ttl_seconds -eq 3600 -and $Identity.channel_auth -ceq "required" -and
        $Identity.broker_auth -ceq "required" -and
        $Identity.broker_mode -ceq "one_time_service_tokens") "RUNTIME_IDENTITY_MISMATCH"
}

function Wait-Healthy([string]$Build) {
    $deadline = [DateTime]::UtcNow.AddSeconds(25)
    do {
        try {
            $response = Send-Runtime "/health"
            Assert-Acceptance ($response.status -eq 200) "HEALTH_HTTP_STATUS"
            Assert-Identity $response.body $Build
            return
        } catch { Start-Sleep -Milliseconds 200 }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "BONDS_ACCEPTANCE_HEALTH_TIMEOUT"
}

function New-TestToken {
    $response = Send-Runtime "/issue" "Admin" @{
        token_type = "service"; subject = "service:orchestrator"; audience = "research-intelligence"
        scopes = @("research:read"); ttl = 3600
    }
    Assert-Acceptance ($response.status -eq 200 -and $response.body.token -cmatch '^bonds_' "TOKEN_ISSUE_FAILED"
    return [string]$response.body.token
}

function Revoke-TestToken([string]$Token) {
    $response = Send-Runtime "/revoke" "Admin" @{ token = $Token }
    Assert-Acceptance ($response.status -eq 200 -and $response.body.revoked -eq $true) "TOKEN_REVOKE_FAILED"
}

function Assert-Token([string]$Token, [bool]$Active, [bool]$Revoked,
    [string]$Build = $originalBuild, [string]$Status = "ok") {
    $response = Send-Runtime "/introspect" "Channel" @{ token = $Token }
    Assert-Acceptance ($response.status -eq 200) "INTROSPECTION_HTTP_STATUS"
    Assert-Identity $response.body.runtime $Build $Status
    Assert-Acceptance ($response.body.claims.active -eq $Active -and
        $response.body.claims.revoked -eq $Revoked -and
        $response.body.claims.token_type -ceq "service") "TOKEN_STATE_MISMATCH"
}

function Get-DatabaseSummary([string]$Path) {
    $code = @'
import json, pathlib, sqlite3, sys
from contextlib import closing
p = pathlib.Path(sys.argv[1]).resolve()
with closing(sqlite3.connect(p.as_uri() + '?mode=ro', uri=True)) as db:
    integrity = db.execute('PRAGMA quick_check').fetchone()[0]
    count, revoked = db.execute('SELECT COUNT(*), COALESCE(SUM(revoked), 0) FROM tokens').fetchone()
print(json.dumps({'integrity': integrity, 'token_count': count, 'revoked_count': revoked}))
'@
    $result = Invoke-Child $pythonExe @("-B", "-c", $code, $Path)
    Assert-Acceptance ($result.exit_code -eq 0) "DATABASE_READ_FAILED"
    return ($result.stdout | ConvertFrom-Json -AsHashtable)
}

function Get-BaselineBytecodeSummary([string]$Path) {
    # Read the timestamp cache created by the real, already-running SCM child.
    # Missing, hash-based, stale, or unexpected bytecode is a failed fixture,
    # never a reason to skip the same-size/same-mtime acceptance condition.
    $code = @'
import hashlib, importlib.util, json, pathlib, struct, sys, types, marshal
source = pathlib.Path(sys.argv[1])
cache = pathlib.Path(importlib.util.cache_from_source(str(source)))
data = cache.read_bytes()
assert data[:4] == importlib.util.MAGIC_NUMBER
flags, mtime, size = struct.unpack('<III', data[4:16])
stat = source.stat()
assert flags == 0
assert mtime == int(stat.st_mtime) & 0xffffffff
assert size == stat.st_size
def find_identity(code):
    if code.co_name == 'runtime_identity':
        return code
    for child in code.co_consts:
        if isinstance(child, types.CodeType):
            found = find_identity(child)
            if found is not None:
                return found
identity = find_identity(marshal.loads(data[16:]))
assert identity is not None and 'ok' in identity.co_consts and 'no' not in identity.co_consts
print(json.dumps({'cache_present': True, 'timestamp_and_size_valid': True,
    'cached_identity_status': 'ok', 'source_size': size, 'source_mtime_seconds': mtime,
    'cache_sha256': hashlib.sha256(data).hexdigest()}))
'@
    $result = Invoke-Child $pythonExe @("-B", "-c", $code, $Path)
    Assert-Acceptance ($result.exit_code -eq 0) "BASELINE_BYTECODE_FIXTURE_UNPROVED"
    return ($result.stdout | ConvertFrom-Json -AsHashtable)
}

function Get-InstalledSourceHashes {
    $hashes = [ordered]@{}
    foreach ($file in $runtimeFiles) {
        $hashes[$file] = (Get-FileHash -LiteralPath (Join-Path $runtimeDirectory $file) -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return $hashes
}

function Set-PrivateDirectoryAcl([string]$Path) {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($identity.User)
    $allowed = @($identity.User.Value, "S-1-5-18", "S-1-5-32-544") | Select-Object -Unique
    foreach ($sid in $allowed) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            [Security.Principal.SecurityIdentifier]::new($sid),
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
            [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
    $verified = Get-Acl -LiteralPath $Path
    Assert-Acceptance $verified.AreAccessRulesProtected "TEMP_DIRECTORY_ACL_NOT_PROTECTED"
    foreach ($rule in $verified.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        Assert-Acceptance ($rule.IdentityReference.Value -in $allowed -and
            $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow) "TEMP_DIRECTORY_ACL_TOO_BROAD"
    }
}

function Remove-OwnedTemporaryTree([string]$Path) {
    Assert-Acceptance ($Path -ceq $temporaryDirectory -and
        [IO.Path]::GetDirectoryName($Path) -ceq $runnerTemporaryDirectory) "TEMP_CLEANUP_PATH_MISMATCH"
    # Git creates read-only object files. Only files in this test-created,
    # ACL-restricted tree may have that attribute cleared for ordinary deletion.
    $entries = [Collections.Generic.List[string]]::new()
    $directories = [Collections.Generic.Stack[string]]::new()
    $directories.Push($Path)
    while ($directories.Count -gt 0) {
        $current = $directories.Pop()
        foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($current)) {
            $attributes = [IO.File]::GetAttributes($entry)
            Assert-Acceptance (($attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "TEMP_CLEANUP_REPARSE_POINT"
            $entries.Add($entry)
            if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $directories.Push($entry) }
        }
    }
    foreach ($entry in $entries) {
        $attributes = [IO.File]::GetAttributes($entry)
        if (($attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
            [IO.File]::SetAttributes($entry, ($attributes -band (-bnot [IO.FileAttributes]::ReadOnly)))
        }
    }
    [IO.Directory]::Delete($Path, $true)
}

# These guards precede machine configuration, filesystem state, or SCM changes.
Assert-Acceptance ($env:GITHUB_ACTIONS -ceq "true" -and $env:RUNNER_OS -ceq "Windows" -and
    $env:BONDS_TOKEN_WINDOWS_ISOLATED_ACCEPTANCE -ceq "1") "ISOLATED_GITHUB_WINDOWS_OPT_IN_REQUIRED"
Assert-Acceptance ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) "WINDOWS_REQUIRED"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
Assert-Acceptance ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) "ADMINISTRATOR_REQUIRED"
$runnerTemporaryDirectory = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path.TrimEnd("\")
$workspace = (Resolve-Path -LiteralPath $env:GITHUB_WORKSPACE).Path.TrimEnd("\")
Assert-Acceptance ([IO.Path]::IsPathFullyQualified($runnerTemporaryDirectory)) "RUNNER_TEMP_ABSOLUTE_REQUIRED"
$programData = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
Assert-Acceptance ($env:ProgramData -ieq $programData) "PROGRAMDATA_IDENTITY_MISMATCH"
$stateDirectory = Join-Path $programData "BondsTokenRuntime"
$runtimeDirectory = Join-Path $stateDirectory "runtime"
$serviceHost = Join-Path $runtimeDirectory "token_service.py"
Assert-AbsentRuntime

$shellExe = (Get-Process -Id $PID).Path
$gitExe = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$pythonExe = (Get-Command python -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$repository = $workspace
$emptyGitConfig = $null
$repository = Invoke-Git @("-C", $PSScriptRoot, "rev-parse", "--show-toplevel")
$repository = [IO.Path]::GetFullPath($repository).TrimEnd("\")
Assert-Acceptance ($repository -ieq $workspace) "CHECKOUT_WORKSPACE_MISMATCH"
$originalBuild = Invoke-Git @("-C", $repository, "rev-parse", "--verify", "HEAD")
Assert-Acceptance ($originalBuild -cmatch '^[0-9a-f]{40}$') "CHECKOUT_SHA_INVALID"
Assert-Acceptance ((Invoke-Git @("-C", $repository, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "REVIEWED_CHECKOUT_NOT_CLEAN"
$originalInstaller = Join-Path $repository "services\bonds_token_runtime\windows\install-token-service.ps1"
$sourceRoot = Join-Path $repository "services\bonds_token_runtime"
$runtimeFiles = @("bonds_security\__init__.py", "bonds_security\server.py", "bonds_security\token_engine.py",
    "contract.json", "token_service.py")
$sourceHashes = [ordered]@{}
foreach ($file in $runtimeFiles) {
    $source = if ($file -ceq "token_service.py") { Join-Path $sourceRoot "windows\token_service.py" } else { Join-Path $sourceRoot $file }
    $sourceHashes[$file] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
}
$sourceHashes["windows\install-token-service.ps1"] = (Get-FileHash -LiteralPath $originalInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
$temporaryDirectory = Join-Path $runnerTemporaryDirectory ("bonds-token-windows-" + [Guid]::NewGuid().ToString("N"))
$candidateCheckout = Join-Path $temporaryDirectory "candidate-checkout"
$database = Join-Path $temporaryDirectory "tokens.sqlite3"
$adminFile = Join-Path $temporaryDirectory "admin.secret"
$channelFile = Join-Path $temporaryDirectory "channel.secret"
$brokerFile = Join-Path $temporaryDirectory "broker.secret"
$machineChanges = @{
    BONDS_TOKEN_DB = $database; BONDS_TOKEN_ADMIN_SECRET_FILE = $adminFile
    BONDS_TOKEN_CHANNEL_SECRET_FILE = $channelFile; BONDS_TOKEN_BROKER_SECRET_FILE = $brokerFile
    BONDS_TOKEN_BUILD_COMMIT = $originalBuild
    BONDS_TOKEN_PORT = "8771"; BONDS_TOKEN_PYTHON_EXE = $pythonExe
}
$originalMachineEnvironment = @{}
foreach ($name in $machineChanges.Keys) {
    $originalMachineEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Machine")
}
$expectedServiceEnvironment = $machineChanges.Clone()
$expectedServiceEnvironment["BONDS_TOKEN_RUNTIME_ROOT"] = $runtimeDirectory
$expectedServiceEnvironment["BONDS_TOKEN_STATE_DIR"] = $stateDirectory
$script:reportPath = Join-Path $runnerTemporaryDirectory "bonds-windows-token-lifecycle-acceptance.json"
Assert-Acceptance (-not (Test-Path -LiteralPath $script:reportPath)) "REPORT_ALREADY_EXISTS"
$script:report = [ordered]@{
    status = "RUNNING"; kind = "windows_isolated_scm_acceptance"; production_executed = $false
    started_at_utc = [DateTime]::UtcNow.ToString("o"); source_commit = $originalBuild
    source_hashes = $sourceHashes; cases = [Collections.Generic.List[object]]::new()
    scope = "Actual Windows SCM/installer on a disposable GitHub Windows runner; loopback-only port 8771."
    limitations = @("No production host, user, Supabase, Capability, Native or site acceptance is performed.",
        "The temporary fault candidate changes runtime identity status only; it is never pushed or deployed.",
        "The candidate fails readiness while alive; this does not inject a service crash or a queued SCM recovery action.")
    cleanup = [ordered]@{
        service_removed = $false; listener_absent = $false; runtime_state_removed = $false
        machine_environment_restored = $false; temporary_files_removed = $false; reviewed_checkout_unchanged = $false
    }
}
$temporaryCreated = $false
$machineConfigured = $false
$activationAttempted = $false
$failure = $null
$adminSecret = $null
$channelSecret = $null
$brokerSecret = $null
$validToken = $null
$revokedToken = $null
$cutoverToken = $null
Write-Report

try {
    [IO.Directory]::CreateDirectory($temporaryDirectory) | Out-Null
    $temporaryCreated = $true
    Set-PrivateDirectoryAcl $temporaryDirectory
    $adminSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    $channelSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    $brokerSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    Assert-Acceptance ($adminSecret -cne $channelSecret -and $adminSecret -cne $brokerSecret -and
        $channelSecret -cne $brokerSecret) "TEST_SECRETS_NOT_DISTINCT"
    [IO.File]::WriteAllText($adminFile, $adminSecret, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($channelFile, $channelSecret, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($brokerFile, $brokerSecret, [Text.UTF8Encoding]::new($false))
    $emptyGitConfig = Join-Path $temporaryDirectory "empty-git-config"
    [IO.File]::WriteAllText($emptyGitConfig, "", [Text.UTF8Encoding]::new($false))
    $emptyHooks = Join-Path $temporaryDirectory "empty-git-hooks"
    [IO.Directory]::CreateDirectory($emptyHooks) | Out-Null
    $machineConfigured = $true
    foreach ($name in $machineChanges.Keys) {
        [Environment]::SetEnvironmentVariable($name, $machineChanges[$name], "Machine")
    }
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $script:client = [Net.Http.HttpClient]::new($handler)
    $script:client.Timeout = [TimeSpan]::FromSeconds(2)

    Invoke-Git @("-c", "core.hooksPath=$emptyHooks", "-c", "core.autocrlf=false",
        "clone", "--no-hardlinks", "--no-checkout", "--", $repository, $candidateCheckout) | Out-Null
    Invoke-Git @("-C", $candidateCheckout, "-c", "core.hooksPath=$emptyHooks",
        "checkout", "--detach", $originalBuild) | Out-Null
    $candidateInstaller = Join-Path $candidateCheckout "services\bonds_token_runtime\windows\install-token-service.ps1"
    $candidateServer = Join-Path $candidateCheckout "services\bonds_token_runtime\bonds_security\server.py"
    $candidateOriginalBytes = [IO.File]::ReadAllBytes($candidateServer)

    Invoke-Case "dirty_runtime_source_is_rejected_before_service_state_or_database_mutation" {
        try {
            [IO.File]::AppendAllText($candidateServer, ([Environment]::NewLine + "# isolated dirty preflight"))
            $attempt = Invoke-Installer $candidateInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "DIRTY_SOURCE_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [IO.File]::WriteAllBytes($candidateServer, $candidateOriginalBytes) }
    }
    Invoke-Case "incorrect_source_sha_is_rejected_before_mutation" {
        try {
            $wrongBuild = if ($originalBuild -cne ("0" * 40)) { "0" * 40 } else { "1" * 40 }
            [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $wrongBuild, "Machine")
            $attempt = Invoke-Installer $originalInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "INCORRECT_SHA_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $originalBuild, "Machine") }
    }
    Invoke-Case "relative_database_path_is_rejected_before_mutation" {
        try {
            [Environment]::SetEnvironmentVariable("BONDS_TOKEN_DB", "bonds-isolated-relative.sqlite3", "Machine")
            $attempt = Invoke-Installer $originalInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "RELATIVE_DATABASE_PATH_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            foreach ($base in @($repository, $sourceRoot)) {
                Assert-Acceptance (-not (Test-Path -LiteralPath (Join-Path $base "bonds-isolated-relative.sqlite3"))) "RELATIVE_DATABASE_CREATED"
            }
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [Environment]::SetEnvironmentVariable("BONDS_TOKEN_DB", $database, "Machine") }
    }
    Invoke-Case "clean_reviewed_source_installs_and_starts_the_managed_scm_service" {
        $script:activationAttempted = $true
        $attempt = Invoke-Installer $originalInstaller
        Assert-Acceptance ($attempt.exit_code -eq 0) "INITIAL_INSTALL_FAILED"
        Wait-ServiceState "Running"
        Assert-OwnedService
        Wait-Healthy $originalBuild
        $listeners = @(Get-TokenListeners)
        Assert-Acceptance ($listeners.Count -eq 1 -and $listeners[0].LocalAddress -ceq "127.0.0.1") "NON_LOOPBACK_OR_MULTIPLE_LISTENERS"
        $installed = Get-InstalledSourceHashes
        foreach ($file in $runtimeFiles) {
            Assert-Acceptance ($installed[$file] -ceq $sourceHashes[$file]) "INSTALLED_SOURCE_MISMATCH"
        }
        return @{ installer_exit_code = 0; service_running = $true; loopback_only = $true; exact_source_verified = $true }
    }
    Invoke-Case "channel_identity_and_issued_revoked_tokens_match_the_live_scm_runtime" {
        Assert-Acceptance ((Send-Runtime "/health" "None").status -eq 401) "HEALTH_CHANNEL_NOT_PROTECTED"
        Assert-Acceptance ((Send-Runtime "/introspect" "None" @{ token = "isolated-unknown" }).status -eq 401) "INTROSPECTION_NOT_PROTECTED"
        Assert-Acceptance ((Send-Runtime "/introspect" "Admin" @{ token = "isolated-unknown" }).status -eq 401) "ADMIN_IS_CHANNEL_CREDENTIAL"
        Assert-Acceptance ((Send-Runtime "/broker/issue" "Admin" @{ audience = "research-intelligence" }).status -eq 401) "ADMIN_IS_BROKER_CREDENTIAL"
        Assert-Acceptance ((Send-Runtime "/broker/issue" "Channel" @{ audience = "research-intelligence" }).status -eq 401) "CHANNEL_IS_BROKER_CREDENTIAL"
        $brokerIssued = Send-Runtime "/broker/issue" "Broker" @{ audience = "research-intelligence" }
        Assert-Acceptance ($brokerIssued.status -eq 200 -and $brokerIssued.body.one_time -eq $true -and
            $brokerIssued.body.token -cmatch '^bonds_' "BROKER_TOKEN_ISSUE_FAILED"
        $brokerFirst = Send-Runtime "/introspect" "Channel" @{ token = [string]$brokerIssued.body.token }
        $brokerSecond = Send-Runtime "/introspect" "Channel" @{ token = [string]$brokerIssued.body.token }
        Assert-Acceptance ($brokerFirst.body.claims.active -eq $true -and
            $brokerSecond.body.claims.active -eq $false -and $brokerSecond.body.claims.revoked -eq $true) "BROKER_TOKEN_NOT_SINGLE_USE"
        $script:validToken = New-TestToken
        $script:revokedToken = New-TestToken
        $script:cutoverToken = New-TestToken
        Revoke-TestToken $revokedToken
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        Assert-Token $cutoverToken $true $false
        $summary = Get-DatabaseSummary $database
        Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 4 -and $summary.revoked_count -eq 2) "INITIAL_DATABASE_STATE"
        return @{ channel_protected = $true; broker_protected = $true; broker_single_use = $true
            valid_token_active = $true; revoked_token_inactive = $true; database = $summary }
    }
    Invoke-Case "actual_scm_restart_preserves_valid_and_revoked_tokens" {
        Assert-OwnedService
        $before = @(Get-TokenListeners)[0].OwningProcess
        Restart-Service -Name $serviceName -ErrorAction Stop
        Wait-ServiceState "Running"
        Wait-Healthy $originalBuild
        $after = @(Get-TokenListeners)[0].OwningProcess
        Assert-Acceptance ($before -ne $after) "RUNTIME_PROCESS_DID_NOT_RESTART"
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        return @{ actual_scm_restart = $true; new_runtime_process = $true; same_database = $true; revocation_persisted = $true }
    }

    $beforeEnvironment = Read-ServiceEnvironment
    $beforeRegistration = Get-ServiceRegistration
    $beforeSource = Get-InstalledSourceHashes
    $installedServer = Join-Path $runtimeDirectory "bonds_security\server.py"
    $baselineBytecode = Get-BaselineBytecodeSummary $installedServer
    $baselineServerTime = [IO.File]::GetLastWriteTimeUtc($installedServer)
    $snapshotsBefore = @(Get-ChildItem -LiteralPath $stateDirectory -Directory |
        Where-Object { $_.Name -like "runtime-rollback-*" } | ForEach-Object { $_.Name })
    $serverText = [IO.File]::ReadAllText($candidateServer)
    $healthyStatus = '"status": "ok",'
    Assert-Acceptance ([regex]::Matches($serverText, [regex]::Escape($healthyStatus)).Count -eq 1) "FAULT_SOURCE_ANCHOR_CHANGED"
    [IO.File]::WriteAllText($candidateServer, $serverText.Replace($healthyStatus, '"status": "no",'),
        [Text.UTF8Encoding]::new($false))
    [IO.File]::SetLastWriteTimeUtc($candidateServer, $baselineServerTime)
    Assert-Acceptance ((Get-Item -LiteralPath $candidateServer).Length -eq $baselineBytecode.source_size -and
        [IO.File]::GetLastWriteTimeUtc($candidateServer) -eq $baselineServerTime) "SAME_SIZE_MTIME_FIXTURE_UNPROVED"
    Invoke-Git @("-C", $candidateCheckout, "add", "--", "services/bonds_token_runtime/bonds_security/server.py") | Out-Null
    Invoke-Git @("-C", $candidateCheckout, "-c", "core.hooksPath=$emptyHooks", "-c", "commit.gpgsign=false",
        "-c", "user.name=BONDS Isolated Acceptance", "-c", "user.email=bonds-isolated-acceptance@example.invalid",
        "commit", "-m", "test-only: fail runtime health for isolated SCM rollback") | Out-Null
    $brokenBuild = Invoke-Git @("-C", $candidateCheckout, "rev-parse", "HEAD")
    Assert-Acceptance ($brokenBuild -cmatch '^[0-9a-f]{40}$' -and $brokenBuild -cne $originalBuild) "FAULT_COMMIT_IDENTITY"
    Assert-Acceptance ((Invoke-Git @("-C", $candidateCheckout, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "FAULT_CHECKOUT_NOT_CLEAN"
    $script:report["temporary_fault_commit"] = $brokenBuild
    $script:report["stale_cache_fixture"] = @{
        baseline_cache = $baselineBytecode; candidate_same_size_and_mtime = $true
        candidate_identity_status = "no"; real_baseline_scm_bytecode_used = $true
        crash_or_queued_recovery_injected = $false
    }
    $script:candidateObservation = @{
        observed = $false; revoked_after_backup = $false; database_sha256_after_revoke = $null
        backup_summary = $null; observations = 0
    }
    Invoke-Case "failed_candidate_health_triggers_actual_automatic_code_and_configuration_rollback" {
        [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $brokenBuild, "Machine")
        $watchCandidate = {
            $health = $null
            try { $health = Send-Runtime "/health" } catch { return }
            if ($health.status -ne 200 -or $health.body.build_commit -cne $brokenBuild) { return }
            Assert-Identity $health.body $brokenBuild "no"
            $script:candidateObservation.observed = $true
            $script:candidateObservation.observations += 1
            if (-not $script:candidateObservation.revoked_after_backup) {
                $newSnapshots = @(Get-ChildItem -LiteralPath $stateDirectory -Directory |
                    Where-Object { $_.Name -like "runtime-rollback-*" -and $_.Name -notin $snapshotsBefore })
                Assert-Acceptance ($newSnapshots.Count -eq 1) "ROLLBACK_SNAPSHOT_NOT_PROVED"
                $backup = Join-Path $newSnapshots[0].FullName "tokens.sqlite3.backup"
                Assert-Acceptance (Test-Path -LiteralPath $backup -PathType Leaf) "ROLLBACK_DATABASE_BACKUP_MISSING"
                $summary = Get-DatabaseSummary $backup
                Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 4 -and $summary.revoked_count -eq 2) "ROLLBACK_BACKUP_BASELINE"
                $script:candidateObservation.backup_summary = $summary
                Revoke-TestToken $cutoverToken
                Assert-Token $cutoverToken $false $true $brokenBuild "no"
                $script:candidateObservation.database_sha256_after_revoke =
                    (Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash.ToLowerInvariant()
                $script:candidateObservation.revoked_after_backup = $true
            }
        }
        $attempt = Invoke-Installer $candidateInstaller $watchCandidate
        Assert-Acceptance ($attempt.exit_code -ne 0) "UNHEALTHY_CANDIDATE_ACCEPTED"
        Assert-Acceptance ($script:candidateObservation.observed -and
            $script:candidateObservation.revoked_after_backup) "CANDIDATE_HEALTH_FAILURE_NOT_OBSERVED"
        Assert-OwnedService
        Wait-ServiceState "Running"
        Wait-Healthy $originalBuild
        $restoredEnvironment = Read-ServiceEnvironment
        Assert-Acceptance ($restoredEnvironment.Count -eq $beforeEnvironment.Count) "SERVICE_ENVIRONMENT_COUNT_CHANGED"
        foreach ($name in $beforeEnvironment.Keys) {
            Assert-Acceptance ($restoredEnvironment[$name] -ceq $beforeEnvironment[$name]) "SERVICE_ENVIRONMENT_NOT_RESTORED"
        }
        $restoredRegistration = Get-ServiceRegistration
        foreach ($name in $beforeRegistration.Keys) {
            Assert-Acceptance ($restoredRegistration[$name] -ceq $beforeRegistration[$name]) "SERVICE_REGISTRATION_NOT_RESTORED"
        }
        $restoredSource = Get-InstalledSourceHashes
        foreach ($file in $runtimeFiles) {
            Assert-Acceptance ($restoredSource[$file] -ceq $beforeSource[$file]) "SOURCE_NOT_RESTORED"
        }
        return @{ installer_exit_nonzero = $true; candidate_unready_build_observed = $true
            actual_code_rollback = $true; original_source_and_service_environment_restored = $true
            original_start_mode_and_registration_restored = $true; same_database = $true
            stale_cache_fixture = "real baseline bytecode with equal candidate source size and mtime"
            broken_candidate_executed_despite_matching_cache_header = $true; crash_or_queued_recovery_injected = $false
            installer_stdout_sha256 = Get-TextHash $attempt.stdout; installer_stderr_sha256 = Get-TextHash $attempt.stderr }
    }
    Invoke-Case "rollback_retains_revocation_committed_after_its_backup" {
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        Assert-Token $cutoverToken $false $true
        $summary = Get-DatabaseSummary $database
        Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 4 -and $summary.revoked_count -eq 3) "RECOVERED_DATABASE_STATE"
        Assert-Acceptance ((Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash.ToLowerInvariant() -ceq
            $script:candidateObservation.database_sha256_after_revoke) "ROLLBACK_REPLACED_CURRENT_DATABASE"
        [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $originalBuild, "Machine")
        return @{ valid_token_active = $true; prior_revocation_persisted = $true
            revocation_after_backup_persisted = $true; database = $summary
            backup_database = $script:candidateObservation.backup_summary
            machine_build_reset_by_harness = $true; service_environment_restored_by_installer = $true }
    }
} catch {
    $failure = Get-SafeFailure $_
    $script:report["failure"] = @{ case = $script:currentCase; code = $failure }
} finally {
    $cleanupFailures = [Collections.Generic.List[string]]::new()
    $childStillRunning = @($script:activeChildren | Where-Object { -not $_.HasExited }).Count -gt 0
    if ($childStillRunning) {
        $cleanupFailures.Add("BONDS_ACCEPTANCE_INSTALLER_STILL_RUNNING")
    } else {
        try {
            if ((Get-ServiceSnapshot).exists) {
                Assert-Acceptance $activationAttempted "UNEXPECTED_SERVICE_DURING_CLEANUP"
                Assert-OwnedService
                Set-Service -Name $serviceName -StartupType Disabled -ErrorAction Stop
                if ((Get-ServiceSnapshot).status -cne "Stopped") {
                    Stop-Service -Name $serviceName -ErrorAction Stop
                    Wait-ServiceState "Stopped"
                }
                $removed = Invoke-Child $pythonExe @("-B", $serviceHost, "remove")
                Assert-Acceptance ($removed.exit_code -eq 0) "SERVICE_REMOVE_FAILED"
            }
            $deadline = [DateTime]::UtcNow.AddSeconds(25)
            do {
                $absent = -not (Get-ServiceSnapshot).exists -and -not (Test-Path -LiteralPath $serviceRegistry)
                if ($absent) { break }
                Start-Sleep -Milliseconds 200
            } while ([DateTime]::UtcNow -lt $deadline)
            Assert-Acceptance $absent "SERVICE_DELETE_PENDING"
            $script:report.cleanup.service_removed = $true
            Assert-Acceptance (@(Get-TokenListeners).Count -eq 0) "LISTENER_REMAINS_AFTER_CLEANUP"
            $script:report.cleanup.listener_absent = $true
            if (Test-Path -LiteralPath $stateDirectory) {
                Assert-Acceptance $activationAttempted "UNEXPECTED_STATE_DURING_CLEANUP"
                [IO.Directory]::Delete($stateDirectory, $true)
            }
            Assert-Acceptance (-not (Test-Path -LiteralPath $stateDirectory)) "RUNTIME_STATE_REMAINS"
            $script:report.cleanup.runtime_state_removed = $true
        } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    }
    try {
        if ($machineConfigured) {
            foreach ($name in $originalMachineEnvironment.Keys) {
                if ($null -eq $originalMachineEnvironment[$name]) {
                    # PowerShell converts an ordinary $null string argument to
                    # empty; .NET 9+ preserves empty environment variables.
                    [Environment]::SetEnvironmentVariable($name, [System.Management.Automation.Language.NullString]::Value, "Machine")
                } else {
                    [Environment]::SetEnvironmentVariable($name, $originalMachineEnvironment[$name], "Machine")
                }
            }
        }
        foreach ($name in $originalMachineEnvironment.Keys) {
            Assert-Acceptance ([Environment]::GetEnvironmentVariable($name, "Machine") -ceq
                $originalMachineEnvironment[$name]) ("MACHINE_ENVIRONMENT_NOT_RESTORED_" + $name)
        }
        $script:report.cleanup.machine_environment_restored = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    try {
        if ($null -ne $script:client) { $script:client.Dispose() }
        Assert-Acceptance (-not $childStillRunning -and $script:report.cleanup.service_removed -and
            $script:report.cleanup.listener_absent) "TEMP_FILES_STILL_IN_USE"
        # Do not leave git configured to read a file after deleting its directory.
        $emptyGitConfig = $null
        if ($temporaryCreated) { Remove-OwnedTemporaryTree $temporaryDirectory }
        Assert-Acceptance (-not (Test-Path -LiteralPath $temporaryDirectory)) "TEMP_FILES_REMAIN"
        $script:report.cleanup.temporary_files_removed = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    try {
        Assert-Acceptance ((Invoke-Git @("-C", $repository, "rev-parse", "HEAD")) -ceq $originalBuild) "REVIEWED_HEAD_CHANGED"
        Assert-Acceptance ((Invoke-Git @("-C", $repository, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "REVIEWED_CHECKOUT_CHANGED"
        $script:report.cleanup.reviewed_checkout_unchanged = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    $adminSecret = $null
    $channelSecret = $null
    $brokerSecret = $null
    $validToken = $null
    $revokedToken = $null
    $cutoverToken = $null
    $allCleanup = @($script:report.cleanup.Values | Where-Object { $_ -ne $true }).Count -eq 0
    $allCases = $script:report.cases.Count -eq 8 -and
        @($script:report.cases | Where-Object { $_.status -cne "PASS" }).Count -eq 0
    $script:report.status = if ($null -eq $failure -and $allCleanup -and $allCases) { "PASS" } else { "FAIL" }
    $script:report["cleanup_failures"] = @($cleanupFailures)
    $script:report["completed_at_utc"] = [DateTime]::UtcNow.ToString("o")
    Write-Report
}

$passed = @($script:report.cases | Where-Object { $_.status -ceq "PASS" }).Count
Write-Host ("Windows isolated SCM acceptance: {0}; cases {1}/8; cleanup={2}; production_executed=false." -f
    $script:report.status, $passed, $allCleanup)
if ($script:report.status -cne "PASS") { throw "BONDS_ACCEPTANCE_WINDOWS_LIFECYCLE_FAILED" }
) "INVALID_TEST_ROUTE"
    $method = if ($null -eq $Body) { [Net.Http.HttpMethod]::Get } else { [Net.Http.HttpMethod]::Post }
    $request = [Net.Http.HttpRequestMessage]::new($method, "http://127.0.0.1:8771$Route")
    $response = $null
    try {
        if ($Credential -ceq "Channel") { $request.Headers.Add("X-Bonds-Channel", $channelSecret) }
        elseif ($Credential -ceq "Admin") { $request.Headers.Add("X-Bonds-Admin", $adminSecret) }
        else { Assert-Acceptance ($Credential -ceq "None") "INVALID_TEST_CREDENTIAL_KIND" }
        if ($null -ne $Body) {
            $request.Content = [Net.Http.StringContent]::new(
                ($Body | ConvertTo-Json -Depth 6 -Compress), [Text.Encoding]::UTF8, "application/json")
        }
        $response = $script:client.SendAsync($request).GetAwaiter().GetResult()
        $raw = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return @{ status = [int]$response.StatusCode; body = ($raw | ConvertFrom-Json -AsHashtable) }
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
}

function Assert-Identity($Identity, [string]$Build, [string]$Status = "ok") {
    Assert-Acceptance ($null -ne $Identity -and $Identity.status -ceq $Status -and
        $Identity.service -ceq "bonds-token-service" -and $Identity.issuer -ceq "bonds-token-service" -and
        $Identity.version -ceq "1.0" -and $Identity.build_commit -ceq $Build -and
        $Identity.contract_version -eq 1 -and $Identity.schema_version -eq 2 -and
        $Identity.service_token_ttl_seconds -eq 3600 -and $Identity.channel_auth -ceq "required") "RUNTIME_IDENTITY_MISMATCH"
}

function Wait-Healthy([string]$Build) {
    $deadline = [DateTime]::UtcNow.AddSeconds(25)
    do {
        try {
            $response = Send-Runtime "/health"
            Assert-Acceptance ($response.status -eq 200) "HEALTH_HTTP_STATUS"
            Assert-Identity $response.body $Build
            return
        } catch { Start-Sleep -Milliseconds 200 }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "BONDS_ACCEPTANCE_HEALTH_TIMEOUT"
}

function New-TestToken {
    $response = Send-Runtime "/issue" "Admin" @{
        token_type = "service"; subject = "service:orchestrator"; audience = "research-intelligence"
        scopes = @("research:read"); ttl = 3600
    }
    Assert-Acceptance ($response.status -eq 200 -and $response.body.token -cmatch '^bonds_' "TOKEN_ISSUE_FAILED"
    return [string]$response.body.token
}

function Revoke-TestToken([string]$Token) {
    $response = Send-Runtime "/revoke" "Admin" @{ token = $Token }
    Assert-Acceptance ($response.status -eq 200 -and $response.body.revoked -eq $true) "TOKEN_REVOKE_FAILED"
}

function Assert-Token([string]$Token, [bool]$Active, [bool]$Revoked,
    [string]$Build = $originalBuild, [string]$Status = "ok") {
    $response = Send-Runtime "/introspect" "Channel" @{ token = $Token }
    Assert-Acceptance ($response.status -eq 200) "INTROSPECTION_HTTP_STATUS"
    Assert-Identity $response.body.runtime $Build $Status
    Assert-Acceptance ($response.body.claims.active -eq $Active -and
        $response.body.claims.revoked -eq $Revoked -and
        $response.body.claims.token_type -ceq "service") "TOKEN_STATE_MISMATCH"
}

function Get-DatabaseSummary([string]$Path) {
    $code = @'
import json, pathlib, sqlite3, sys
from contextlib import closing
p = pathlib.Path(sys.argv[1]).resolve()
with closing(sqlite3.connect(p.as_uri() + '?mode=ro', uri=True)) as db:
    integrity = db.execute('PRAGMA quick_check').fetchone()[0]
    count, revoked = db.execute('SELECT COUNT(*), COALESCE(SUM(revoked), 0) FROM tokens').fetchone()
print(json.dumps({'integrity': integrity, 'token_count': count, 'revoked_count': revoked}))
'@
    $result = Invoke-Child $pythonExe @("-B", "-c", $code, $Path)
    Assert-Acceptance ($result.exit_code -eq 0) "DATABASE_READ_FAILED"
    return ($result.stdout | ConvertFrom-Json -AsHashtable)
}

function Get-BaselineBytecodeSummary([string]$Path) {
    # Read the timestamp cache created by the real, already-running SCM child.
    # Missing, hash-based, stale, or unexpected bytecode is a failed fixture,
    # never a reason to skip the same-size/same-mtime acceptance condition.
    $code = @'
import hashlib, importlib.util, json, pathlib, struct, sys, types, marshal
source = pathlib.Path(sys.argv[1])
cache = pathlib.Path(importlib.util.cache_from_source(str(source)))
data = cache.read_bytes()
assert data[:4] == importlib.util.MAGIC_NUMBER
flags, mtime, size = struct.unpack('<III', data[4:16])
stat = source.stat()
assert flags == 0
assert mtime == int(stat.st_mtime) & 0xffffffff
assert size == stat.st_size
def find_identity(code):
    if code.co_name == 'runtime_identity':
        return code
    for child in code.co_consts:
        if isinstance(child, types.CodeType):
            found = find_identity(child)
            if found is not None:
                return found
identity = find_identity(marshal.loads(data[16:]))
assert identity is not None and 'ok' in identity.co_consts and 'no' not in identity.co_consts
print(json.dumps({'cache_present': True, 'timestamp_and_size_valid': True,
    'cached_identity_status': 'ok', 'source_size': size, 'source_mtime_seconds': mtime,
    'cache_sha256': hashlib.sha256(data).hexdigest()}))
'@
    $result = Invoke-Child $pythonExe @("-B", "-c", $code, $Path)
    Assert-Acceptance ($result.exit_code -eq 0) "BASELINE_BYTECODE_FIXTURE_UNPROVED"
    return ($result.stdout | ConvertFrom-Json -AsHashtable)
}

function Get-InstalledSourceHashes {
    $hashes = [ordered]@{}
    foreach ($file in $runtimeFiles) {
        $hashes[$file] = (Get-FileHash -LiteralPath (Join-Path $runtimeDirectory $file) -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return $hashes
}

function Set-PrivateDirectoryAcl([string]$Path) {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($identity.User)
    $allowed = @($identity.User.Value, "S-1-5-18", "S-1-5-32-544") | Select-Object -Unique
    foreach ($sid in $allowed) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            [Security.Principal.SecurityIdentifier]::new($sid),
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit",
            [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
    $verified = Get-Acl -LiteralPath $Path
    Assert-Acceptance $verified.AreAccessRulesProtected "TEMP_DIRECTORY_ACL_NOT_PROTECTED"
    foreach ($rule in $verified.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        Assert-Acceptance ($rule.IdentityReference.Value -in $allowed -and
            $rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow) "TEMP_DIRECTORY_ACL_TOO_BROAD"
    }
}

function Remove-OwnedTemporaryTree([string]$Path) {
    Assert-Acceptance ($Path -ceq $temporaryDirectory -and
        [IO.Path]::GetDirectoryName($Path) -ceq $runnerTemporaryDirectory) "TEMP_CLEANUP_PATH_MISMATCH"
    # Git creates read-only object files. Only files in this test-created,
    # ACL-restricted tree may have that attribute cleared for ordinary deletion.
    $entries = [Collections.Generic.List[string]]::new()
    $directories = [Collections.Generic.Stack[string]]::new()
    $directories.Push($Path)
    while ($directories.Count -gt 0) {
        $current = $directories.Pop()
        foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($current)) {
            $attributes = [IO.File]::GetAttributes($entry)
            Assert-Acceptance (($attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "TEMP_CLEANUP_REPARSE_POINT"
            $entries.Add($entry)
            if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $directories.Push($entry) }
        }
    }
    foreach ($entry in $entries) {
        $attributes = [IO.File]::GetAttributes($entry)
        if (($attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
            [IO.File]::SetAttributes($entry, ($attributes -band (-bnot [IO.FileAttributes]::ReadOnly)))
        }
    }
    [IO.Directory]::Delete($Path, $true)
}

# These guards precede machine configuration, filesystem state, or SCM changes.
Assert-Acceptance ($env:GITHUB_ACTIONS -ceq "true" -and $env:RUNNER_OS -ceq "Windows" -and
    $env:BONDS_TOKEN_WINDOWS_ISOLATED_ACCEPTANCE -ceq "1") "ISOLATED_GITHUB_WINDOWS_OPT_IN_REQUIRED"
Assert-Acceptance ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) "WINDOWS_REQUIRED"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
Assert-Acceptance ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) "ADMINISTRATOR_REQUIRED"
$runnerTemporaryDirectory = (Resolve-Path -LiteralPath $env:RUNNER_TEMP).Path.TrimEnd("\")
$workspace = (Resolve-Path -LiteralPath $env:GITHUB_WORKSPACE).Path.TrimEnd("\")
Assert-Acceptance ([IO.Path]::IsPathFullyQualified($runnerTemporaryDirectory)) "RUNNER_TEMP_ABSOLUTE_REQUIRED"
$programData = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
Assert-Acceptance ($env:ProgramData -ieq $programData) "PROGRAMDATA_IDENTITY_MISMATCH"
$stateDirectory = Join-Path $programData "BondsTokenRuntime"
$runtimeDirectory = Join-Path $stateDirectory "runtime"
$serviceHost = Join-Path $runtimeDirectory "token_service.py"
Assert-AbsentRuntime

$shellExe = (Get-Process -Id $PID).Path
$gitExe = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$pythonExe = (Get-Command python -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$repository = $workspace
$emptyGitConfig = $null
$repository = Invoke-Git @("-C", $PSScriptRoot, "rev-parse", "--show-toplevel")
$repository = [IO.Path]::GetFullPath($repository).TrimEnd("\")
Assert-Acceptance ($repository -ieq $workspace) "CHECKOUT_WORKSPACE_MISMATCH"
$originalBuild = Invoke-Git @("-C", $repository, "rev-parse", "--verify", "HEAD")
Assert-Acceptance ($originalBuild -cmatch '^[0-9a-f]{40}$') "CHECKOUT_SHA_INVALID"
Assert-Acceptance ((Invoke-Git @("-C", $repository, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "REVIEWED_CHECKOUT_NOT_CLEAN"
$originalInstaller = Join-Path $repository "services\bonds_token_runtime\windows\install-token-service.ps1"
$sourceRoot = Join-Path $repository "services\bonds_token_runtime"
$runtimeFiles = @("bonds_security\__init__.py", "bonds_security\server.py", "bonds_security\token_engine.py",
    "contract.json", "token_service.py")
$sourceHashes = [ordered]@{}
foreach ($file in $runtimeFiles) {
    $source = if ($file -ceq "token_service.py") { Join-Path $sourceRoot "windows\token_service.py" } else { Join-Path $sourceRoot $file }
    $sourceHashes[$file] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
}
$sourceHashes["windows\install-token-service.ps1"] = (Get-FileHash -LiteralPath $originalInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
$temporaryDirectory = Join-Path $runnerTemporaryDirectory ("bonds-token-windows-" + [Guid]::NewGuid().ToString("N"))
$candidateCheckout = Join-Path $temporaryDirectory "candidate-checkout"
$database = Join-Path $temporaryDirectory "tokens.sqlite3"
$adminFile = Join-Path $temporaryDirectory "admin.secret"
$channelFile = Join-Path $temporaryDirectory "channel.secret"
$machineChanges = @{
    BONDS_TOKEN_DB = $database; BONDS_TOKEN_ADMIN_SECRET_FILE = $adminFile
    BONDS_TOKEN_CHANNEL_SECRET_FILE = $channelFile; BONDS_TOKEN_BUILD_COMMIT = $originalBuild
    BONDS_TOKEN_PORT = "8771"; BONDS_TOKEN_PYTHON_EXE = $pythonExe
}
$originalMachineEnvironment = @{}
foreach ($name in $machineChanges.Keys) {
    $originalMachineEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Machine")
}
$expectedServiceEnvironment = $machineChanges.Clone()
$expectedServiceEnvironment["BONDS_TOKEN_RUNTIME_ROOT"] = $runtimeDirectory
$expectedServiceEnvironment["BONDS_TOKEN_STATE_DIR"] = $stateDirectory
$script:reportPath = Join-Path $runnerTemporaryDirectory "bonds-windows-token-lifecycle-acceptance.json"
Assert-Acceptance (-not (Test-Path -LiteralPath $script:reportPath)) "REPORT_ALREADY_EXISTS"
$script:report = [ordered]@{
    status = "RUNNING"; kind = "windows_isolated_scm_acceptance"; production_executed = $false
    started_at_utc = [DateTime]::UtcNow.ToString("o"); source_commit = $originalBuild
    source_hashes = $sourceHashes; cases = [Collections.Generic.List[object]]::new()
    scope = "Actual Windows SCM/installer on a disposable GitHub Windows runner; loopback-only port 8771."
    limitations = @("No production host, user, Supabase, Capability, Native or site acceptance is performed.",
        "The temporary fault candidate changes runtime identity status only; it is never pushed or deployed.",
        "The candidate fails readiness while alive; this does not inject a service crash or a queued SCM recovery action.")
    cleanup = [ordered]@{
        service_removed = $false; listener_absent = $false; runtime_state_removed = $false
        machine_environment_restored = $false; temporary_files_removed = $false; reviewed_checkout_unchanged = $false
    }
}
$temporaryCreated = $false
$machineConfigured = $false
$activationAttempted = $false
$failure = $null
$adminSecret = $null
$channelSecret = $null
$validToken = $null
$revokedToken = $null
$cutoverToken = $null
Write-Report

try {
    [IO.Directory]::CreateDirectory($temporaryDirectory) | Out-Null
    $temporaryCreated = $true
    Set-PrivateDirectoryAcl $temporaryDirectory
    $adminSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    $channelSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    Assert-Acceptance ($adminSecret -cne $channelSecret) "TEST_SECRETS_NOT_DISTINCT"
    [IO.File]::WriteAllText($adminFile, $adminSecret, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($channelFile, $channelSecret, [Text.UTF8Encoding]::new($false))
    $emptyGitConfig = Join-Path $temporaryDirectory "empty-git-config"
    [IO.File]::WriteAllText($emptyGitConfig, "", [Text.UTF8Encoding]::new($false))
    $emptyHooks = Join-Path $temporaryDirectory "empty-git-hooks"
    [IO.Directory]::CreateDirectory($emptyHooks) | Out-Null
    $machineConfigured = $true
    foreach ($name in $machineChanges.Keys) {
        [Environment]::SetEnvironmentVariable($name, $machineChanges[$name], "Machine")
    }
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $script:client = [Net.Http.HttpClient]::new($handler)
    $script:client.Timeout = [TimeSpan]::FromSeconds(2)

    Invoke-Git @("-c", "core.hooksPath=$emptyHooks", "-c", "core.autocrlf=false",
        "clone", "--no-hardlinks", "--no-checkout", "--", $repository, $candidateCheckout) | Out-Null
    Invoke-Git @("-C", $candidateCheckout, "-c", "core.hooksPath=$emptyHooks",
        "checkout", "--detach", $originalBuild) | Out-Null
    $candidateInstaller = Join-Path $candidateCheckout "services\bonds_token_runtime\windows\install-token-service.ps1"
    $candidateServer = Join-Path $candidateCheckout "services\bonds_token_runtime\bonds_security\server.py"
    $candidateOriginalBytes = [IO.File]::ReadAllBytes($candidateServer)

    Invoke-Case "dirty_runtime_source_is_rejected_before_service_state_or_database_mutation" {
        try {
            [IO.File]::AppendAllText($candidateServer, ([Environment]::NewLine + "# isolated dirty preflight"))
            $attempt = Invoke-Installer $candidateInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "DIRTY_SOURCE_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [IO.File]::WriteAllBytes($candidateServer, $candidateOriginalBytes) }
    }
    Invoke-Case "incorrect_source_sha_is_rejected_before_mutation" {
        try {
            $wrongBuild = if ($originalBuild -cne ("0" * 40)) { "0" * 40 } else { "1" * 40 }
            [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $wrongBuild, "Machine")
            $attempt = Invoke-Installer $originalInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "INCORRECT_SHA_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $originalBuild, "Machine") }
    }
    Invoke-Case "relative_database_path_is_rejected_before_mutation" {
        try {
            [Environment]::SetEnvironmentVariable("BONDS_TOKEN_DB", "bonds-isolated-relative.sqlite3", "Machine")
            $attempt = Invoke-Installer $originalInstaller
            Assert-Acceptance ($attempt.exit_code -ne 0) "RELATIVE_DATABASE_PATH_ACCEPTED"
            Assert-AbsentRuntime
            Assert-Acceptance (-not (Test-Path -LiteralPath $database)) "PREFLIGHT_CREATED_DATABASE"
            foreach ($base in @($repository, $sourceRoot)) {
                Assert-Acceptance (-not (Test-Path -LiteralPath (Join-Path $base "bonds-isolated-relative.sqlite3"))) "RELATIVE_DATABASE_CREATED"
            }
            return @{ installer_exit_nonzero = $true; scm_state_database_unchanged = $true }
        } finally { [Environment]::SetEnvironmentVariable("BONDS_TOKEN_DB", $database, "Machine") }
    }
    Invoke-Case "clean_reviewed_source_installs_and_starts_the_managed_scm_service" {
        $script:activationAttempted = $true
        $attempt = Invoke-Installer $originalInstaller
        Assert-Acceptance ($attempt.exit_code -eq 0) "INITIAL_INSTALL_FAILED"
        Wait-ServiceState "Running"
        Assert-OwnedService
        Wait-Healthy $originalBuild
        $listeners = @(Get-TokenListeners)
        Assert-Acceptance ($listeners.Count -eq 1 -and $listeners[0].LocalAddress -ceq "127.0.0.1") "NON_LOOPBACK_OR_MULTIPLE_LISTENERS"
        $installed = Get-InstalledSourceHashes
        foreach ($file in $runtimeFiles) {
            Assert-Acceptance ($installed[$file] -ceq $sourceHashes[$file]) "INSTALLED_SOURCE_MISMATCH"
        }
        return @{ installer_exit_code = 0; service_running = $true; loopback_only = $true; exact_source_verified = $true }
    }
    Invoke-Case "channel_identity_and_issued_revoked_tokens_match_the_live_scm_runtime" {
        Assert-Acceptance ((Send-Runtime "/health" "None").status -eq 401) "HEALTH_CHANNEL_NOT_PROTECTED"
        Assert-Acceptance ((Send-Runtime "/introspect" "None" @{ token = "isolated-unknown" }).status -eq 401) "INTROSPECTION_NOT_PROTECTED"
        Assert-Acceptance ((Send-Runtime "/introspect" "Admin" @{ token = "isolated-unknown" }).status -eq 401) "ADMIN_IS_CHANNEL_CREDENTIAL"
        $script:validToken = New-TestToken
        $script:revokedToken = New-TestToken
        $script:cutoverToken = New-TestToken
        Revoke-TestToken $revokedToken
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        Assert-Token $cutoverToken $true $false
        $summary = Get-DatabaseSummary $database
        Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 3 -and $summary.revoked_count -eq 1) "INITIAL_DATABASE_STATE"
        return @{ channel_protected = $true; valid_token_active = $true; revoked_token_inactive = $true; database = $summary }
    }
    Invoke-Case "actual_scm_restart_preserves_valid_and_revoked_tokens" {
        Assert-OwnedService
        $before = @(Get-TokenListeners)[0].OwningProcess
        Restart-Service -Name $serviceName -ErrorAction Stop
        Wait-ServiceState "Running"
        Wait-Healthy $originalBuild
        $after = @(Get-TokenListeners)[0].OwningProcess
        Assert-Acceptance ($before -ne $after) "RUNTIME_PROCESS_DID_NOT_RESTART"
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        return @{ actual_scm_restart = $true; new_runtime_process = $true; same_database = $true; revocation_persisted = $true }
    }

    $beforeEnvironment = Read-ServiceEnvironment
    $beforeRegistration = Get-ServiceRegistration
    $beforeSource = Get-InstalledSourceHashes
    $installedServer = Join-Path $runtimeDirectory "bonds_security\server.py"
    $baselineBytecode = Get-BaselineBytecodeSummary $installedServer
    $baselineServerTime = [IO.File]::GetLastWriteTimeUtc($installedServer)
    $snapshotsBefore = @(Get-ChildItem -LiteralPath $stateDirectory -Directory |
        Where-Object { $_.Name -like "runtime-rollback-*" } | ForEach-Object { $_.Name })
    $serverText = [IO.File]::ReadAllText($candidateServer)
    $healthyStatus = '"status": "ok",'
    Assert-Acceptance ([regex]::Matches($serverText, [regex]::Escape($healthyStatus)).Count -eq 1) "FAULT_SOURCE_ANCHOR_CHANGED"
    [IO.File]::WriteAllText($candidateServer, $serverText.Replace($healthyStatus, '"status": "no",'),
        [Text.UTF8Encoding]::new($false))
    [IO.File]::SetLastWriteTimeUtc($candidateServer, $baselineServerTime)
    Assert-Acceptance ((Get-Item -LiteralPath $candidateServer).Length -eq $baselineBytecode.source_size -and
        [IO.File]::GetLastWriteTimeUtc($candidateServer) -eq $baselineServerTime) "SAME_SIZE_MTIME_FIXTURE_UNPROVED"
    Invoke-Git @("-C", $candidateCheckout, "add", "--", "services/bonds_token_runtime/bonds_security/server.py") | Out-Null
    Invoke-Git @("-C", $candidateCheckout, "-c", "core.hooksPath=$emptyHooks", "-c", "commit.gpgsign=false",
        "-c", "user.name=BONDS Isolated Acceptance", "-c", "user.email=bonds-isolated-acceptance@example.invalid",
        "commit", "-m", "test-only: fail runtime health for isolated SCM rollback") | Out-Null
    $brokenBuild = Invoke-Git @("-C", $candidateCheckout, "rev-parse", "HEAD")
    Assert-Acceptance ($brokenBuild -cmatch '^[0-9a-f]{40}$' -and $brokenBuild -cne $originalBuild) "FAULT_COMMIT_IDENTITY"
    Assert-Acceptance ((Invoke-Git @("-C", $candidateCheckout, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "FAULT_CHECKOUT_NOT_CLEAN"
    $script:report["temporary_fault_commit"] = $brokenBuild
    $script:report["stale_cache_fixture"] = @{
        baseline_cache = $baselineBytecode; candidate_same_size_and_mtime = $true
        candidate_identity_status = "no"; real_baseline_scm_bytecode_used = $true
        crash_or_queued_recovery_injected = $false
    }
    $script:candidateObservation = @{
        observed = $false; revoked_after_backup = $false; database_sha256_after_revoke = $null
        backup_summary = $null; observations = 0
    }
    Invoke-Case "failed_candidate_health_triggers_actual_automatic_code_and_configuration_rollback" {
        [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $brokenBuild, "Machine")
        $watchCandidate = {
            $health = $null
            try { $health = Send-Runtime "/health" } catch { return }
            if ($health.status -ne 200 -or $health.body.build_commit -cne $brokenBuild) { return }
            Assert-Identity $health.body $brokenBuild "no"
            $script:candidateObservation.observed = $true
            $script:candidateObservation.observations += 1
            if (-not $script:candidateObservation.revoked_after_backup) {
                $newSnapshots = @(Get-ChildItem -LiteralPath $stateDirectory -Directory |
                    Where-Object { $_.Name -like "runtime-rollback-*" -and $_.Name -notin $snapshotsBefore })
                Assert-Acceptance ($newSnapshots.Count -eq 1) "ROLLBACK_SNAPSHOT_NOT_PROVED"
                $backup = Join-Path $newSnapshots[0].FullName "tokens.sqlite3.backup"
                Assert-Acceptance (Test-Path -LiteralPath $backup -PathType Leaf) "ROLLBACK_DATABASE_BACKUP_MISSING"
                $summary = Get-DatabaseSummary $backup
                Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 3 -and $summary.revoked_count -eq 1) "ROLLBACK_BACKUP_BASELINE"
                $script:candidateObservation.backup_summary = $summary
                Revoke-TestToken $cutoverToken
                Assert-Token $cutoverToken $false $true $brokenBuild "no"
                $script:candidateObservation.database_sha256_after_revoke =
                    (Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash.ToLowerInvariant()
                $script:candidateObservation.revoked_after_backup = $true
            }
        }
        $attempt = Invoke-Installer $candidateInstaller $watchCandidate
        Assert-Acceptance ($attempt.exit_code -ne 0) "UNHEALTHY_CANDIDATE_ACCEPTED"
        Assert-Acceptance ($script:candidateObservation.observed -and
            $script:candidateObservation.revoked_after_backup) "CANDIDATE_HEALTH_FAILURE_NOT_OBSERVED"
        Assert-OwnedService
        Wait-ServiceState "Running"
        Wait-Healthy $originalBuild
        $restoredEnvironment = Read-ServiceEnvironment
        Assert-Acceptance ($restoredEnvironment.Count -eq $beforeEnvironment.Count) "SERVICE_ENVIRONMENT_COUNT_CHANGED"
        foreach ($name in $beforeEnvironment.Keys) {
            Assert-Acceptance ($restoredEnvironment[$name] -ceq $beforeEnvironment[$name]) "SERVICE_ENVIRONMENT_NOT_RESTORED"
        }
        $restoredRegistration = Get-ServiceRegistration
        foreach ($name in $beforeRegistration.Keys) {
            Assert-Acceptance ($restoredRegistration[$name] -ceq $beforeRegistration[$name]) "SERVICE_REGISTRATION_NOT_RESTORED"
        }
        $restoredSource = Get-InstalledSourceHashes
        foreach ($file in $runtimeFiles) {
            Assert-Acceptance ($restoredSource[$file] -ceq $beforeSource[$file]) "SOURCE_NOT_RESTORED"
        }
        return @{ installer_exit_nonzero = $true; candidate_unready_build_observed = $true
            actual_code_rollback = $true; original_source_and_service_environment_restored = $true
            original_start_mode_and_registration_restored = $true; same_database = $true
            stale_cache_fixture = "real baseline bytecode with equal candidate source size and mtime"
            broken_candidate_executed_despite_matching_cache_header = $true; crash_or_queued_recovery_injected = $false
            installer_stdout_sha256 = Get-TextHash $attempt.stdout; installer_stderr_sha256 = Get-TextHash $attempt.stderr }
    }
    Invoke-Case "rollback_retains_revocation_committed_after_its_backup" {
        Assert-Token $validToken $true $false
        Assert-Token $revokedToken $false $true
        Assert-Token $cutoverToken $false $true
        $summary = Get-DatabaseSummary $database
        Assert-Acceptance ($summary.integrity -ceq "ok" -and $summary.token_count -eq 3 -and $summary.revoked_count -eq 2) "RECOVERED_DATABASE_STATE"
        Assert-Acceptance ((Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash.ToLowerInvariant() -ceq
            $script:candidateObservation.database_sha256_after_revoke) "ROLLBACK_REPLACED_CURRENT_DATABASE"
        [Environment]::SetEnvironmentVariable("BONDS_TOKEN_BUILD_COMMIT", $originalBuild, "Machine")
        return @{ valid_token_active = $true; prior_revocation_persisted = $true
            revocation_after_backup_persisted = $true; database = $summary
            backup_database = $script:candidateObservation.backup_summary
            machine_build_reset_by_harness = $true; service_environment_restored_by_installer = $true }
    }
} catch {
    $failure = Get-SafeFailure $_
    $script:report["failure"] = @{ case = $script:currentCase; code = $failure }
} finally {
    $cleanupFailures = [Collections.Generic.List[string]]::new()
    $childStillRunning = @($script:activeChildren | Where-Object { -not $_.HasExited }).Count -gt 0
    if ($childStillRunning) {
        $cleanupFailures.Add("BONDS_ACCEPTANCE_INSTALLER_STILL_RUNNING")
    } else {
        try {
            if ((Get-ServiceSnapshot).exists) {
                Assert-Acceptance $activationAttempted "UNEXPECTED_SERVICE_DURING_CLEANUP"
                Assert-OwnedService
                Set-Service -Name $serviceName -StartupType Disabled -ErrorAction Stop
                if ((Get-ServiceSnapshot).status -cne "Stopped") {
                    Stop-Service -Name $serviceName -ErrorAction Stop
                    Wait-ServiceState "Stopped"
                }
                $removed = Invoke-Child $pythonExe @("-B", $serviceHost, "remove")
                Assert-Acceptance ($removed.exit_code -eq 0) "SERVICE_REMOVE_FAILED"
            }
            $deadline = [DateTime]::UtcNow.AddSeconds(25)
            do {
                $absent = -not (Get-ServiceSnapshot).exists -and -not (Test-Path -LiteralPath $serviceRegistry)
                if ($absent) { break }
                Start-Sleep -Milliseconds 200
            } while ([DateTime]::UtcNow -lt $deadline)
            Assert-Acceptance $absent "SERVICE_DELETE_PENDING"
            $script:report.cleanup.service_removed = $true
            Assert-Acceptance (@(Get-TokenListeners).Count -eq 0) "LISTENER_REMAINS_AFTER_CLEANUP"
            $script:report.cleanup.listener_absent = $true
            if (Test-Path -LiteralPath $stateDirectory) {
                Assert-Acceptance $activationAttempted "UNEXPECTED_STATE_DURING_CLEANUP"
                [IO.Directory]::Delete($stateDirectory, $true)
            }
            Assert-Acceptance (-not (Test-Path -LiteralPath $stateDirectory)) "RUNTIME_STATE_REMAINS"
            $script:report.cleanup.runtime_state_removed = $true
        } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    }
    try {
        if ($machineConfigured) {
            foreach ($name in $originalMachineEnvironment.Keys) {
                if ($null -eq $originalMachineEnvironment[$name]) {
                    # PowerShell converts an ordinary $null string argument to
                    # empty; .NET 9+ preserves empty environment variables.
                    [Environment]::SetEnvironmentVariable($name, [System.Management.Automation.Language.NullString]::Value, "Machine")
                } else {
                    [Environment]::SetEnvironmentVariable($name, $originalMachineEnvironment[$name], "Machine")
                }
            }
        }
        foreach ($name in $originalMachineEnvironment.Keys) {
            Assert-Acceptance ([Environment]::GetEnvironmentVariable($name, "Machine") -ceq
                $originalMachineEnvironment[$name]) ("MACHINE_ENVIRONMENT_NOT_RESTORED_" + $name)
        }
        $script:report.cleanup.machine_environment_restored = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    try {
        if ($null -ne $script:client) { $script:client.Dispose() }
        Assert-Acceptance (-not $childStillRunning -and $script:report.cleanup.service_removed -and
            $script:report.cleanup.listener_absent) "TEMP_FILES_STILL_IN_USE"
        # Do not leave git configured to read a file after deleting its directory.
        $emptyGitConfig = $null
        if ($temporaryCreated) { Remove-OwnedTemporaryTree $temporaryDirectory }
        Assert-Acceptance (-not (Test-Path -LiteralPath $temporaryDirectory)) "TEMP_FILES_REMAIN"
        $script:report.cleanup.temporary_files_removed = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    try {
        Assert-Acceptance ((Invoke-Git @("-C", $repository, "rev-parse", "HEAD")) -ceq $originalBuild) "REVIEWED_HEAD_CHANGED"
        Assert-Acceptance ((Invoke-Git @("-C", $repository, "status", "--porcelain=v1", "--untracked-files=all")) -ceq "") "REVIEWED_CHECKOUT_CHANGED"
        $script:report.cleanup.reviewed_checkout_unchanged = $true
    } catch { $cleanupFailures.Add((Get-SafeFailure $_)) }
    $adminSecret = $null
    $channelSecret = $null
    $validToken = $null
    $revokedToken = $null
    $cutoverToken = $null
    $allCleanup = @($script:report.cleanup.Values | Where-Object { $_ -ne $true }).Count -eq 0
    $allCases = $script:report.cases.Count -eq 8 -and
        @($script:report.cases | Where-Object { $_.status -cne "PASS" }).Count -eq 0
    $script:report.status = if ($null -eq $failure -and $allCleanup -and $allCases) { "PASS" } else { "FAIL" }
    $script:report["cleanup_failures"] = @($cleanupFailures)
    $script:report["completed_at_utc"] = [DateTime]::UtcNow.ToString("o")
    Write-Report
}

$passed = @($script:report.cases | Where-Object { $_.status -ceq "PASS" }).Count
Write-Host ("Windows isolated SCM acceptance: {0}; cases {1}/8; cleanup={2}; production_executed=false." -f
    $script:report.status, $passed, $allCleanup)
if ($script:report.status -cne "PASS") { throw "BONDS_ACCEPTANCE_WINDOWS_LIFECYCLE_FAILED" }
