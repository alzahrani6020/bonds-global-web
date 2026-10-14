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
            }
        } catch {
            $status = $null
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = $null }
            }

            $last = [pscustomobject]@{
                ok = $false
                status = $status
                attempt = $attempt
                body = $null
                error = $_.Exception.Message
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

$localHealthy = Boolean($local.ok -and $local.body -and $local.body.ok -eq $true -and $local.body.runtime.available -eq $true)
$remoteHealthy = Boolean($remote.ok -and $remote.body -and $remote.body.ok -eq $true -and $remote.body.runtime.available -eq $true)
$productionHealthy = Boolean(
    $production.ok -and
    $production.body -and
    $production.body.status -eq "ok" -and
    $production.body.checks.native -eq "ok" -and
    $production.body.inference.mode -eq "REMOTE_BONDS_NATIVE" -and
    $production.body.inference.provider -eq "BondsNativeProvider" -and
    $production.body.inference.reachable -eq $true
)

$result = [pscustomobject]@{
    ok = Boolean($localHealthy -and $remoteHealthy -and $productionHealthy)
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    checks = [pscustomobject]@{
        local = [pscustomobject]@{
            ok = $localHealthy
            http_status = $local.status
            attempt = $local.attempt
            error = $local.error
        }
        remote = [pscustomobject]@{
            ok = $remoteHealthy
            http_status = $remote.status
            attempt = $remote.attempt
            error = $remote.error
        }
        production = [pscustomobject]@{
            ok = $productionHealthy
            http_status = $production.status
            attempt = $production.attempt
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
