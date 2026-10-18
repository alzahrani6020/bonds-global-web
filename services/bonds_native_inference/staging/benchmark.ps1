# Run this in another terminal after start-engine.ps1. No production request is made.
[CmdletBinding()]
param([ValidateRange(1,65535)][int]$Port=18965,
[string]$Root=(Join-Path $env:LOCALAPPDATA 'BondsInferenceStaging'),
[ValidateSet('cpu','vulkan')][string]$Profile='cpu',
[Parameter(Mandatory=$true)][string]$PayloadPath,
[ValidateRange(1,100)][int]$Runs=10,
[ValidateRange(1,100)][int]$Warmups=1,
[ValidateRange(30,3600)][int]$TimeoutSec=600)
$ErrorActionPreference='Stop'
if ($Port -eq 8765 -or $Port -eq 8771) {throw 'Protected production port'}
$payload=Get-Content $PayloadPath -Raw|ConvertFrom-Json
if (-not $payload.messages -or $payload.max_tokens -ne 900) {throw 'Payload must include messages and max_tokens=900; no silent defaults'}
$uri="http://127.0.0.1:$Port/v1/chat/completions"
$logDir=Join-Path $Root 'logs';New-Item -ItemType Directory -Force $logDir|Out-Null
$output=Join-Path $logDir 'benchmark.jsonl'
$body=$payload|ConvertTo-Json -Depth 100 -Compress
for ($i=0; $i -lt ($Warmups+$Runs);$i++) {
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $ok=$false;$usage=$null;$errorMessage=$null;$statusCode=$null
  try {
    $reply=Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType 'application/json' -TimeoutSec $TimeoutSec
    $usage=$reply.usage
    $ok=($null -ne $reply.choices -and $reply.choices.Count -gt 0)
  } catch {
    $errorMessage=$_.Exception.Message
    if ($_.Exception.Response) {$statusCode=[int]$_.Exception.Response.StatusCode}
  }
  $watch.Stop()
  $row=[ordered]@{utc=[DateTime]::UtcNow.ToString('o');profile=$Profile;port=$Port;run=$i;warmup=($i -lt $Warmups);success=$ok;elapsed_s=[Math]::Round($watch.Elapsed.TotalSeconds,3);prompt_tokens=$usage.prompt_tokens;completion_tokens=$usage.completion_tokens;total_tokens=$usage.total_tokens;http_status=$statusCode;error=$errorMessage}
  ($row|ConvertTo-Json -Compress -Depth 5)|Add-Content -Path $output
  $row|ConvertTo-Json -Compress
}
