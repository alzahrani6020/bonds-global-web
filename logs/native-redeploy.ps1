$ErrorActionPreference = 'Stop'
$model = 'C:\ProgramData\BondsNative\models\gemma-4-E4B-it-Q4_K_M.gguf'
$installer = 'C:\Users\vip\bonds-global-web\services\bonds_native_inference\windows\install-runtime-service.ps1'

Write-Host '== Step 1: close leftover installer window =='
Stop-Process -Id 27664 -Force -ErrorAction SilentlyContinue

Write-Host '== Step 2: prepare runtime (copy code + env) =='
& $installer -ModelPath $model

Write-Host '== Step 3: stop service running old code =='
Stop-Service BondsNativeRuntimeService -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host '== Step 4: activate with health check + rollback =='
& $installer -ModelPath $model -Activate

Write-Host '== DONE =='
Get-Service BondsNativeRuntimeService | Select-Object Status
