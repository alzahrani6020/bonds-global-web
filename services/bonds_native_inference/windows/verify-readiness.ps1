param(
    [string]$LocalUrl = "http://127.0.0.1:8765/health",
    [string]$RemoteUrl = "https://native.bonds-global.com/health",
    [string]$ProductionHealthUrl = "https://bonds-global.com/api/health",
    [int]$TimeoutSeconds = 8,
    [int]$Retries = 3,
    [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured."
}

function Invoke-JsonProbe {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers = @{}
    )

    $last = $null
    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Uri -Headers $Headers -TimeoutSec $TimeoutSeconds
            $json = $null
            try {
                $json = $response.Content | ConvertFrom-Json
            } catch {
                $json = $null
            }

            return [pscustomobject]@{
                ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
                status = [int]$response.StatusCode
                attempt = $attempt
                body = $json
                error = $null
                error_class = $null
            }
        } catch {
            $status = $null
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $null }
            }

            $message = [string]$_.Exception.Message
            $errorClass = "UNREACHABLE"
            if ($status -eq 530) {
                $errorClass = "TUNNEL_ORIGIN_FAILURE"
            } elseif ($status -eq 401 -or $status -eq 403) {
                $errorClass = "AUTH_FAILURE"
            } elseif ($message -match "(?i)timed out|timeout|operation has timed out") {
                $errorClass = "TIMEOUT"
            } elseif ($status -ge 500 -and $status -lt 600) {
                $errorClass = "APPLICATION_HEALTH_FAILURE"
            } elseif ($status) {
                $errorClass = "HTTP_FAILURE"
            }

            $last = [pscustomobject]@{
                ok = $false
                status = $status
                attempt = $attempt
                body = $null
                error = $message
                error_class = $errorClass
            }

            if ($attempt -lt $Retries) {
                Start-Sleep -Seconds $RetryDelaySeconds
            }
        }
    }

    return $last
}

$authHeaders = @{ Authorization = "Bearer $token" }

$local = Invoke-JsonProbe -Uri $LocalUrl -Headers $authHeaders
$remote = Invoke-JsonProbe -Uri $RemoteUrl -Headers $authHeaders
$production = Invoke-JsonProbe -Uri $ProductionHealthUrl

$localHealthy = [bool]($local.ok -and $local.body -and $local.body.ok -eq $true -and $local.body.runtime.available -eq $true)
$remoteHealthy = [bool]($remote.ok -and $remote.body -and $remote.body.ok -eq $true -and $remote.body.runtime.available -eq $true)
$productionHealthy = [bool](
    $production.ok -and
    $production.body -and
    $production.body.status -eq "ok" -and
    $production.body.checks.native -eq "ok" -and
    $production.body.inference.mode -eq "REMOTE_BONDS_NATIVE" -and
    $production.body.inference.provider -eq "BondsNativeProvider" -and
    $production.body.inference.reachable -eq $true
)

$result = [pscustomobject]@{
    ok = [bool]($localHealthy -and $remoteHealthy -and $productionHealthy)
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    checks = [pscustomobject]@{
        local = [pscustomobject]@{
            ok = $localHealthy
            http_status = $local.status
            attempt = $local.attempt
            error_class = $local.error_class
            error = $local.error
        }
        remote = [pscustomobject]@{
            ok = $remoteHealthy
            http_status = $remote.status
            attempt = $remote.attempt
            error_class = $remote.error_class
            error = $remote.error
        }
        production = [pscustomobject]@{
            ok = $productionHealthy
            http_status = $production.status
            attempt = $production.attempt
            error_class = $production.error_class
            error = $production.error
            mode = if ($production.body) { $production.body.inference.mode } else { $null }
            provider = if ($production.body) { $production.body.inference.provider } else { $null }
            reachable = if ($production.body) { $production.body.inference.reachable } else { $false }
        }
    }
}

$result | ConvertTo-Json -Depth 8

if (-not $result.ok) {
    exit 1
}

exit 0
