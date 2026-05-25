# =============================================
#  Bonds File Cleanup - PowerShell Execution
#  Reads duplicates.json and moves files
# =============================================

param(
    [string]$JsonPath = "duplicates.json",
    [string]$TargetDrive = "D:\BondsCleanup\Duplicates"
)

function Format-Size {
    param([long]$Size)
    if ($Size -gt 1TB) { return "{0:N2} TB" -f ($Size / 1TB) }
    if ($Size -gt 1GB) { return "{0:N2} GB" -f ($Size / 1GB) }
    if ($Size -gt 1MB) { return "{0:N2} MB" -f ($Size / 1MB) }
    if ($Size -gt 1KB) { return "{0:N2} KB" -f ($Size / 1KB) }
    return "$Size B"
}

function Get-Category($ext) {
    $e = $ext.ToLower()
    $images = @(".jpg",".jpeg",".png",".gif",".bmp",".webp",".tiff",".ico",".heic",".raw",".svg")
    $videos = @(".mp4",".avi",".mkv",".mov",".wmv",".flv",".webm",".m4v",".mpg",".mpeg")
    $audio = @(".mp3",".wav",".flac",".aac",".ogg",".m4a",".wma")
    $docs = @(".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".rtf",".csv",".md")
    $archives = @(".zip",".rar",".7z",".tar",".gz",".bz2",".iso")
    $apps = @(".exe",".msi",".dmg",".pkg",".deb",".rpm",".appx")
    $code = @(".py",".js",".ts",".html",".css",".java",".cpp",".c",".cs",".php",".go",".rs",".sql")
    $design = @(".psd",".ai",".xd",".sketch",".fig",".aep",".prproj")
    if ($images -contains $e) { return "Images" }
    if ($videos -contains $e) { return "Videos" }
    if ($audio -contains $e) { return "Audio" }
    if ($docs -contains $e) { return "Documents" }
    if ($archives -contains $e) { return "Archives" }
    if ($apps -contains $e) { return "Apps" }
    if ($code -contains $e) { return "Code" }
    if ($design -contains $e) { return "Design" }
    return "Others"
}

function Safe-Move {
    param([string]$Source, [string]$Destination)
    $dest = [System.IO.Path]::GetDirectoryName($Destination)
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    }
    $finalDest = $Destination
    $counter = 1
    while (Test-Path $finalDest) {
        $dir = [System.IO.Path]::GetDirectoryName($Destination)
        $name = [System.IO.Path]::GetFileNameWithoutExtension($Destination)
        $ext = [System.IO.Path]::GetExtension($Destination)
        $finalDest = Join-Path $dir "${name}_($counter)${ext}"
        $counter++
    }
    try {
        Move-Item -Path $Source -Destination $finalDest -Force
        return $true
    } catch {
        Write-Host "      ERROR: $_" -ForegroundColor Red
        return $false
    }
}

# =============================================
#  Main
# =============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bonds File Cleanup - PowerShell" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Target: $TargetDrive" -ForegroundColor Yellow

# Check D:
if (-not (Test-Path "D:\")) {
    Write-Host "ERROR: D: drive not found!" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $TargetDrive)) {
    New-Item -ItemType Directory -Path $TargetDrive -Force | Out-Null
}

# Load JSON
$jsonFile = Resolve-Path $JsonPath -ErrorAction SilentlyContinue
if (-not $jsonFile) {
    Write-Host "ERROR: $JsonPath not found! Run scan first." -ForegroundColor Red
    exit 1
}

Write-Host "`nLoading scan results..." -ForegroundColor Gray
$data = Get-Content $jsonFile -Raw | ConvertFrom-Json
$duplicates = $data.duplicates
$allFiles = $data.all_files

Write-Host "  Total scanned: $($data.total_files)" -ForegroundColor Cyan
Write-Host "  Duplicates found: $($data.duplicate_count)" -ForegroundColor Yellow

if ($duplicates.Count -eq 0) {
    Write-Host "`nNo duplicates to move." -ForegroundColor Green
    exit 0
}

# Step 1: Move duplicates
Write-Host "`nStep 1: Moving duplicates to D:..." -ForegroundColor Cyan
$moved = 0
$failed = 0
$movedSize = 0
$processedPaths = @{}

for ($i = 0; $i -lt $duplicates.Count; $i++) {
    $dup = $duplicates[$i]
    if (($i + 1) % 100 -eq 0) {
        Write-Progress -Activity "Moving duplicates" -Status "$($i+1) / $($duplicates.Count)" -PercentComplete ((($i+1)/$duplicates.Count)*100)
    }

    $src = $dup.duplicate
    if ($processedPaths.ContainsKey($src)) { continue }

    $relPath = $src.Replace($env:USERPROFILE, "").TrimStart("\")
    $dest = Join-Path $TargetDrive $relPath

    if (Safe-Move -Source $src -Destination $dest) {
        $moved++
        $movedSize += $dup.size
        $processedPaths[$src] = $true
    } else {
        $failed++
    }
}

Write-Progress -Activity "Done" -Completed
Write-Host "   Moved: $moved files ($(Format-Size $movedSize))" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "   Failed: $failed files" -ForegroundColor Red
}

# Step 2: Organize remaining files
Write-Host "`nStep 2: Organizing remaining files..." -ForegroundColor Cyan
$remaining = $allFiles | Where-Object { -not $processedPaths.ContainsKey($_.path) }
$orgCount = 0
$orgFailed = 0

for ($i = 0; $i -lt $remaining.Count; $i++) {
    $file = $remaining[$i]
    if (($i + 1) % 500 -eq 0) {
        Write-Progress -Activity "Organizing files" -Status "$($i+1) / $($remaining.Count)" -PercentComplete ((($i+1)/$remaining.Count)*100)
    }

    $src = $file.path
    if (-not (Test-Path $src)) { continue }

    $baseDir = [System.IO.Path]::GetDirectoryName($src)
    $category = Get-Category -ext $file.ext
    $dt = [datetime]::Parse($file.mtime)
    $year = $dt.Year.ToString()
    $month = $dt.ToString("MM-MMMM")

    $orgDir = Join-Path $baseDir "_Organized" $category $year $month
    $dest = Join-Path $orgDir $file.name

    if (Safe-Move -Source $src -Destination $dest) {
        $orgCount++
    } else {
        $orgFailed++
    }
}

Write-Progress -Activity "Done" -Completed
Write-Host "   Organized: $orgCount files" -ForegroundColor Green
if ($orgFailed -gt 0) {
    Write-Host "   Failed: $orgFailed files" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Duplicates moved:  $moved files ($(Format-Size $movedSize))" -ForegroundColor Yellow
Write-Host "  Files organized:   $orgCount files" -ForegroundColor Green
Write-Host "  Total failed:      $($failed + $orgFailed)" -ForegroundColor $(if (($failed+$orgFailed) -gt 0) {"Red"} else {"Green"})
Write-Host "`n  Locations:" -ForegroundColor White
Write-Host "     D:\BondsCleanup\Duplicates\  <- Duplicate files" -ForegroundColor Yellow
Write-Host "     _Organized\                   <- Sorted by type/date" -ForegroundColor Green
Write-Host "`n  Space saved on C:  $(Format-Size $movedSize)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Save log
$logPath = "$env:USERPROFILE\Desktop\BondsCleanup_Log_$(Get-Date -Format 'yyyyMMdd_HHmm').txt"
$log = @"
Bonds File Cleanup Log
========================================
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Duplicates moved: $moved ($(Format-Size $movedSize))
Files organized: $orgCount
Failed: $($failed + $orgFailed)

Target: $TargetDrive
========================================
"@
$log | Out-File -FilePath $logPath -Encoding UTF8
Write-Host "Log saved to: $logPath" -ForegroundColor Gray
