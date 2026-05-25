$dest = Join-Path $PSScriptRoot "assets\_extract_logo"
Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$zip = Get-ChildItem -LiteralPath "C:\Users\vip\Downloads" -Filter "*.zip" -File |
    Where-Object { $_.Name -like "* (1).zip" } |
    Select-Object -First 1
if (-not $zip) {
    $zip = Get-ChildItem -LiteralPath "C:\Users\vip\Downloads" -Filter "*.zip" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

if (-not $zip) {
    Write-Host "No zip in Downloads"
    exit 1
}

Write-Host "ZIP:" $zip.FullName
Expand-Archive -LiteralPath $zip.FullName -DestinationPath $dest -Force

Get-ChildItem $dest -Recurse -File |
    Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|svg|webp|pdf|ai|eps)$' } |
    ForEach-Object { Write-Host ($_.FullName + "  " + $_.Length) }
