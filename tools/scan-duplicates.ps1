# Bonds Duplicate Scanner v2 - Fast Dry Run
# Filters by size first, then hashes only suspects

param([string]$OutputReport = "")

function Get-FileHashFast {
    param([string]$Path)
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hash = [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "")
        $stream.Close()
        return $hash
    } catch { return $null }
    finally { if ($stream) { $stream.Close() } }
}

function Format-Size {
    param([long]$Size)
    if ($Size -gt 1TB) { return "{0:N2} TB" -f ($Size / 1TB) }
    if ($Size -gt 1GB) { return "{0:N2} GB" -f ($Size / 1GB) }
    if ($Size -gt 1MB) { return "{0:N2} MB" -f ($Size / 1MB) }
    if ($Size -gt 1KB) { return "{0:N2} KB" -f ($Size / 1KB) }
    return "$Size bytes"
}

$folders = @(
    @{ Path = "$env:USERPROFILE\Downloads"; Name = "Downloads" },
    @{ Path = "$env:USERPROFILE\Desktop"; Name = "Desktop" },
    @{ Path = "$env:USERPROFILE\Documents"; Name = "Documents" },
    @{ Path = "$env:USERPROFILE\Pictures"; Name = "Pictures" },
    @{ Path = "$env:USERPROFILE\Videos"; Name = "Videos" }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bonds Duplicate Scanner v2 - DRY RUN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mode: Simulation (no files moved)" -ForegroundColor Green
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "  Optimization: Size-filter before hash" -ForegroundColor Gray

$validFolders = $folders | Where-Object { Test-Path $_.Path }
if ($validFolders.Count -eq 0) {
    Write-Host "ERROR: No target folders found!" -ForegroundColor Red
    exit 1
}

Write-Host "`nTarget folders:" -ForegroundColor Magenta
foreach ($f in $validFolders) {
    $items = Get-ChildItem -Path $f.Path -File -Recurse -ErrorAction SilentlyContinue
    $size = ($items | Measure-Object -Property Length -Sum).Sum
    $count = $items.Count
    Write-Host "   $($f.Name): $count files ($(Format-Size $size))" -ForegroundColor Yellow
}

Write-Host "`nCollecting files from all folders..." -ForegroundColor Cyan
$allFiles = @()
$excludePatterns = @("AppData", "OneDrive", "Temp", "Cache", "\.git", "node_modules", "venv", "\.venv")

foreach ($f in $validFolders) {
    Write-Host "   Scanning $($f.Name)... " -NoNewline -ForegroundColor Gray
    $files = Get-ChildItem -Path $f.Path -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $full = $_.FullName
        $valid = $true
        foreach ($pat in $excludePatterns) {
            if ($full -like "*$pat*") { $valid = $false; break }
        }
        $valid
    }
    $allFiles += $files | Select-Object FullName, Name, Length, LastWriteTime, DirectoryName, Extension, @{N="Source";E={$f.Name}}
    Write-Host "$($files.Count) files" -ForegroundColor White
}

$totalFiles = $allFiles.Count
$totalSize = ($allFiles | Measure-Object -Property Length -Sum).Sum

Write-Host "`nTOTAL: $totalFiles files ($(Format-Size $totalSize))" -ForegroundColor Cyan

if ($totalFiles -eq 0) {
    Write-Host "`nNo files to scan!" -ForegroundColor Green
    exit 0
}

# =============================================
#  Step 1: Group by size (fast filter)
# =============================================
Write-Host "`nStep 1: Grouping by file size..." -ForegroundColor Cyan
$sizeGroups = @{}
foreach ($file in $allFiles) {
    $sizeKey = $file.Length.ToString()
    if (-not $sizeGroups.ContainsKey($sizeKey)) {
        $sizeGroups[$sizeKey] = @()
    }
    $sizeGroups[$sizeKey] += $file
}

# Only keep groups with same size > 1 (potential duplicates)
$suspectGroups = $sizeGroups.Values | Where-Object { $_.Count -gt 1 }
$suspectCount = ($suspectGroups | Measure-Object -Property Count -Sum).Sum
$totalSuspectGroups = $suspectGroups.Count

Write-Host "   Potential duplicate groups by size: $totalSuspectGroups" -ForegroundColor Yellow
Write-Host "   Files needing hash check: $suspectCount" -ForegroundColor Yellow

if ($totalSuspectGroups -eq 0) {
    Write-Host "`nNo duplicates found! All files have unique sizes." -ForegroundColor Green
    exit 0
}

# =============================================
#  Step 2: Hash only suspects
# =============================================
Write-Host "`nStep 2: Hashing suspect files..." -ForegroundColor Cyan
$hashTable = @{}
$failed = 0
$hashed = 0
$totalSuspects = $suspectCount

foreach ($group in $suspectGroups) {
    foreach ($file in $group) {
        $hashed++
        if ($hashed % 100 -eq 0) {
            Write-Progress -Activity "Hashing suspects" -Status "$hashed / $totalSuspects" -PercentComplete (($hashed/$totalSuspects)*100)
        }

        $hash = Get-FileHashFast -Path $file.FullName
        if ($hash) {
            if (-not $hashTable.ContainsKey($hash)) {
                $hashTable[$hash] = @()
            }
            $hashTable[$hash] += $file
        } else {
            $failed++
        }
    }
}

Write-Progress -Activity "Done" -Completed

# =============================================
#  Step 3: Analyze results
# =============================================
$duplicateGroups = $hashTable.Values | Where-Object { $_.Count -gt 1 }
$duplicateCount = ($duplicateGroups | ForEach-Object { $_.Count - 1 } | Measure-Object -Sum).Sum
$duplicateSize = 0

foreach ($group in $duplicateGroups) {
    $sorted = $group | Sort-Object LastWriteTime
    for ($i = 1; $i -lt $sorted.Count; $i++) {
        $duplicateSize += $sorted[$i].Length
    }
}

$dupBySource = @{}
foreach ($group in $duplicateGroups) {
    $sorted = $group | Sort-Object LastWriteTime
    for ($i = 1; $i -lt $sorted.Count; $i++) {
        $src = $sorted[$i].Source
        if (-not $dupBySource.ContainsKey($src)) { $dupBySource[$src] = @{ Count = 0; Size = 0 } }
        $dupBySource[$src].Count++
        $dupBySource[$src].Size += $sorted[$i].Length
    }
}

$dupByType = @{}
foreach ($group in $duplicateGroups) {
    $sorted = $group | Sort-Object LastWriteTime
    for ($i = 1; $i -lt $sorted.Count; $i++) {
        $ext = $sorted[$i].Extension.ToLower()
        if (-not $ext) { $ext = "(no extension)" }
        if (-not $dupByType.ContainsKey($ext)) { $dupByType[$ext] = @{ Count = 0; Size = 0 } }
        $dupByType[$ext].Count++
        $dupByType[$ext].Size += $sorted[$i].Length
    }
}

$topDuplicates = @(
    foreach ($group in $duplicateGroups) {
        $sorted = $group | Sort-Object LastWriteTime
        for ($i = 1; $i -lt $sorted.Count; $i++) {
            [PSCustomObject]@{
                Name = $sorted[$i].Name
                Size = $sorted[$i].Length
                Source = $sorted[$i].Source
                Original = $sorted[0].Source
            }
        }
    }
) | Sort-Object Size -Descending | Select-Object -First 10

# =============================================
#  Display results
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SCAN RESULTS (DRY RUN)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "  Files scanned:       " -NoNewline; Write-Host $totalFiles -ForegroundColor Cyan
Write-Host "  Suspects checked:    " -NoNewline; Write-Host $hashed -ForegroundColor Yellow
Write-Host "  Failed hashes:       " -NoNewline; Write-Host $failed -ForegroundColor $(if($failed -gt 0){"Red"}else{"Green"})
Write-Host "  Duplicate groups:    " -NoNewline; Write-Host $duplicateGroups.Count -ForegroundColor Yellow
Write-Host "  Duplicate files:     " -NoNewline; Write-Host $duplicateCount -ForegroundColor Yellow
Write-Host "  Space recoverable:   " -NoNewline; Write-Host (Format-Size $duplicateSize) -ForegroundColor Green

Write-Host "`nDuplicates by folder:" -ForegroundColor Magenta
if ($dupBySource.Count -eq 0) {
    Write-Host "   (none)" -ForegroundColor DarkGray
} else {
    foreach ($src in $dupBySource.Keys | Sort-Object) {
        Write-Host "   $src`: $($dupBySource[$src].Count) files ($(Format-Size $dupBySource[$src].Size))" -ForegroundColor Yellow
    }
}

Write-Host "`nDuplicates by type (top 10):" -ForegroundColor Magenta
if ($dupByType.Count -eq 0) {
    Write-Host "   (none)" -ForegroundColor DarkGray
} else {
    foreach ($ext in ($dupByType.Keys | Sort-Object { $dupByType[$_].Size } -Descending | Select-Object -First 10)) {
        Write-Host "   $ext`: $($dupByType[$ext].Count) files ($(Format-Size $dupByType[$ext].Size))" -ForegroundColor Yellow
    }
}

if ($topDuplicates.Count -gt 0) {
    Write-Host "`nTop 10 largest duplicates:" -ForegroundColor Magenta
    foreach ($d in $topDuplicates) {
        Write-Host "   $(Format-Size $d.Size) | $($d.Name)" -ForegroundColor White
        Write-Host "      Original: $($d.Original) | Duplicate: $($d.Source)" -ForegroundColor DarkGray
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SAMPLE GROUPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$sample = $duplicateGroups | Select-Object -First 5
if ($sample.Count -eq 0) {
    Write-Host "   No duplicate groups to display." -ForegroundColor DarkGray
} else {
    foreach ($group in $sample) {
        $sorted = $group | Sort-Object LastWriteTime
        Write-Host "`n  FILE: $($sorted[0].Name) ($(Format-Size $sorted[0].Length))" -ForegroundColor Cyan
        foreach ($f in $sorted) {
            $marker = if ($f -eq $sorted[0]) { "[ORIGINAL]" } else { "[DUPLICATE]" }
            Write-Host "     $marker [$($f.Source)] $($f.FullName)" -ForegroundColor $(if ($f -eq $sorted[0]) { "Green" } else { "Yellow" })
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RECOMMENDATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
if ($duplicateCount -eq 0) {
    Write-Host "  No duplicates found! Your PC is clean." -ForegroundColor Green
} else {
    Write-Host "  If you run the actual cleanup:" -ForegroundColor White
    Write-Host "     - $duplicateCount duplicate files will move to D:\BondsCleanup\Duplicates\" -ForegroundColor Yellow
    Write-Host "     - You will save $(Format-Size $duplicateSize) of space!" -ForegroundColor Green
    Write-Host "     - Original files stay in place" -ForegroundColor Gray
    Write-Host "`n  Next step: Run the actual organizer" -ForegroundColor Cyan
}

if (-not $OutputReport) {
    $OutputReport = "$env:USERPROFILE\Desktop\DuplicateScan_Report_$(Get-Date -Format 'yyyyMMdd_HHmm').txt"
}

$report = @"
========================================
   Duplicate Scan Report - Bonds Scanner v2
   Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
   MODE: DRY RUN (Simulation only)
========================================

Files scanned:      $totalFiles
Suspects checked:   $hashed
Failed hashes:      $failed
Duplicate groups:   $($duplicateGroups.Count)
Duplicate files:    $duplicateCount
Space recoverable:  $(Format-Size $duplicateSize)

--- Duplicates by folder ---
"@

foreach ($src in $dupBySource.Keys | Sort-Object) {
    $report += "`n$src`: $($dupBySource[$src].Count) files ($(Format-Size $dupBySource[$src].Size))"
}

$report += "`n`n--- Duplicates by type (top 10) ---"
foreach ($ext in ($dupByType.Keys | Sort-Object { $dupByType[$_].Size } -Descending | Select-Object -First 10)) {
    $report += "`n$ext`: $($dupByType[$ext].Count) files ($(Format-Size $dupByType[$ext].Size))"
}

$report += "`n`n--- Sample groups ---"
$sample = $duplicateGroups | Select-Object -First 10
foreach ($group in $sample) {
    $sorted = $group | Sort-Object LastWriteTime
    $report += "`n`nFILE: $($sorted[0].Name) ($(Format-Size $sorted[0].Length))"
    foreach ($f in $sorted) {
        $marker = if ($f -eq $sorted[0]) { "ORIGINAL" } else { "DUPLICATE" }
        $report += "`n  [$marker] [$($f.Source)] $($f.FullName)"
    }
}

$report += "`n`n========================================"
$report | Out-File -FilePath $OutputReport -Encoding UTF8

Write-Host "`nFull report saved to:" -ForegroundColor Magenta
Write-Host "   $OutputReport" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DRY RUN COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
