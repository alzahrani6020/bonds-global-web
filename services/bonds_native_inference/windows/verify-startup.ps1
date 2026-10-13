param(
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"

$token = [Environment]::GetEnvironmentVariable("BONDS_NATIVE_TOKEN", "Machine")
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Machine-level BONDS_NATIVE_TOKEN is not configured."
}

$headers = @{ Authorization = "Bearer $token" }
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$lastError = $null

do {
    try {
        $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8765/health" -Headers $headers -TimeoutSec 5
        if ($health.ok -eq $true -and $health.runtime.available -eq $true) {
            [pscustomobject]@{
                ok = $true
                backend = $health.runtime.backend
                model_available = $health.runtime.model_available
                gpu_offload_supported = $health.runtime.gpu_offload_supported
                native_task = (Get-ScheduledTask -TaskName "BondsNativeRuntime" -ErrorAction SilentlyContinue).State
                tunnel_task = (Get-ScheduledTask -TaskName "BondsNativeTunnel" -ErrorAction SilentlyContinue).State
            } | ConvertTo-Json -Depth 5
            exit 0
        }
        $lastError = "health returned unavailable"
    } catch {
        $lastError = $_.Exception.Message
    }

    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

throw "Bonds Native startup verification failed: $lastError"
