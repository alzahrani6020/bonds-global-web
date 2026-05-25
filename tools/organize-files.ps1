# =============================================
#  سكربت تنظيم الملفات المتكررة والمنظف الذكي
#  Bonds File Organizer v1.0
# =============================================

param(
    [string]$TargetPath = "",
    [switch]$DryRun = $false,
    [switch]$DuplicatesOnly = $false
)

Add-Type -AssemblyName System.Windows.Forms

# --- الألوان للعرض الجميل ---
$Host.UI.RawUI.BackgroundColor = "Black"
$colors = @{
    Header  = "Cyan"
    Info    = "White"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Accent  = "Magenta"
}

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor $colors.Header
    Write-Host "  $text" -ForegroundColor $colors.Header
    Write-Host "========================================" -ForegroundColor $colors.Header
}

function Write-Info($text) { Write-Host "[ℹ️] $text" -ForegroundColor $colors.Info }
function Write-Success($text) { Write-Host "[✅] $text" -ForegroundColor $colors.Success }
function Write-Warn($text) { Write-Host "[⚠️] $text" -ForegroundColor $colors.Warning }
function Write-Error($text) { Write-Host "[❌] $text" -ForegroundColor $colors.Error }

# --- نقل الملف لسلة المحذوفات بدلاً من الحذف النهائي ---
function Move-ToRecycleBin {
    param([string]$Path)
    try {
        $shell = New-Object -ComObject Shell.Application
        $folder = $shell.Namespace(0).ParseName((Resolve-Path $Path).Path)
        $folder.InvokeVerb("delete")
        return $true
    } catch {
        # fallback: نقل لمجلد _Trash داخل المسار الهدف
        $trashDir = Join-Path $script:baseDir "_Trash"
        if (-not (Test-Path $trashDir)) { New-Item -ItemType Directory -Path $trashDir -Force | Out-Null }
        $dest = Join-Path $trashDir (Split-Path $Path -Leaf)
        Move-Item -Path $Path -Destination $dest -Force
        return $true
    }
}

# --- حساب Hash للملف ---
function Get-FileHashFast {
    param([string]$Path)
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hash = [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "")
        $stream.Close()
        return $hash
    } catch {
        return $null
    }
}

# --- تحديد نوع الملف ---
function Get-Category($file) {
    $ext = $file.Extension.ToLower()
    switch -Regex ($ext) {
        "\.(jpg|jpeg|png|gif|bmp|webp|tiff|ico|heic|raw|svg)$" { return "Images" }
        "\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpg|mpeg)$"      { return "Videos" }
        "\.(mp3|wav|flac|aac|ogg|m4a|wma)$"                   { return "Audio" }
        "\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|md)$"  { return "Documents" }
        "\.(zip|rar|7z|tar|gz|bz2|iso)$"                      { return "Archives" }
        "\.(exe|msi|dmg|pkg|deb|rpm|appx)$"                  { return "Apps" }
        "\.(psd|ai|xd|sketch|fig|aep|prproj)$"               { return "Design" }
        "\.(py|js|ts|html|css|java|cpp|c|cs|php|go|rs|sql)$"  { return "Code" }
        default                                               { return "Others" }
    }
}

# =============================================
#  بداية التنفيذ
# =============================================

Write-Header "Bonds File Organizer - تنظيم الملفات الذكي"
Write-Host "  الوضع الجاف (Dry Run): " -NoNewline
Write-Host $(if ($DryRun) { "مفعل ✅" } else { "معطل ❌" }) -ForegroundColor $(if ($DryRun) { "Green" } else { "Yellow" })
Write-Host "  فقط التكرارات: " -NoNewline
Write-Host $(if ($DuplicatesOnly) { "نعم" } else { "لا" }) -ForegroundColor $colors.Info

# --- اختيار المسار ---
if (-not $TargetPath -or -not (Test-Path $TargetPath)) {
    Write-Info "اختر المجلد الذي تريد تنظيفه..."
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "اختر مجلد التنظيف"
    $dialog.RootFolder = "Desktop"
    if ($dialog.ShowDialog() -eq "OK") {
        $TargetPath = $dialog.SelectedPath
    } else {
        Write-Error "لم يتم اختيار مجلد. إلغاء العملية."
        exit 1
    }
}

$script:baseDir = Resolve-Path $TargetPath
Write-Info "المجلد المختار: $baseDir"

# --- إحصائيات ---
$stats = @{
    Scanned       = 0
    Duplicates    = 0
    Organized     = 0
    MovedToTrash  = 0
    Errors        = 0
    Categories    = @{}
}

# --- جمع الملفات ---
Write-Header "1️⃣  فحص الملفات..."
$files = Get-ChildItem -Path $baseDir -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $_.FullName -notmatch "\\_Trash\\" -and
    $_.FullName -notmatch "\\_Organized\\" -and
    $_.FullName -notmatch "\\_Duplicates\\"
}

$total = $files.Count
Write-Info "تم العثور على $total ملف"

if ($total -eq 0) {
    Write-Warn "لا يوجد ملفات للتنظيف!"
    exit 0
}

# =============================================
#  البحث عن التكرارات
# =============================================

Write-Header "2️⃣  البحث عن الملفات المتكررة..."
$hashTable = @{}
$duplicateGroups = @()

$counter = 0
foreach ($file in $files) {
    $counter++
    if ($counter % 100 -eq 0) {
        Write-Progress -Activity "حساب بصمة الملفات" -Status "$counter / $total" -PercentComplete (($counter/$total)*100)
    }

    $hash = Get-FileHashFast -Path $file.FullName
    if ($hash) {
        if ($hashTable.ContainsKey($hash)) {
            $hashTable[$hash] += $file
        } else {
            $hashTable[$hash] = @($file)
        }
    }
}

$duplicateGroups = $hashTable.Values | Where-Object { $_.Count -gt 1 }
$stats.Duplicates = ($duplicateGroups | ForEach-Object { $_.Count - 1 } | Measure-Object -Sum).Sum

if ($stats.Duplicates -gt 0) {
    Write-Warn "تم العثور على $($stats.Duplicates) ملف مكرر في $($duplicateGroups.Count) مجموعة"

    $dupDir = Join-Path $baseDir "_Duplicates"
    if (-not $DryRun -and -not (Test-Path $dupDir)) {
        New-Item -ItemType Directory -Path $dupDir -Force | Out-Null
    }

    foreach ($group in $duplicateGroups) {
        # نحتفظ بأول نسخة (أقدم تاريخ) وننقل البقية
        $original = $group | Sort-Object CreationTime | Select-Object -First 1
        $copies = $group | Where-Object { $_.FullName -ne $original.FullName }

        foreach ($dup in $copies) {
            $relDir = $dup.DirectoryName.Replace($baseDir, "").TrimStart("\")
            $targetSubdir = Join-Path $dupDir $relDir
            $targetPath = Join-Path $targetSubdir $dup.Name

            $suffix = 1
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($dup.Name)
            $ext = $dup.Extension
            while (Test-Path $targetPath) {
                $targetPath = Join-Path $targetSubdir "${baseName}_($suffix)${ext}"
                $suffix++
            }

            if (-not $DryRun) {
                if (-not (Test-Path $targetSubdir)) {
                    New-Item -ItemType Directory -Path $targetSubdir -Force | Out-Null
                }
                try {
                    Move-Item -Path $dup.FullName -Destination $targetPath -Force
                    $stats.MovedToTrash++
                } catch {
                    $stats.Errors++
                }
            }
        }
    }

    Write-Success "تم عزل الملفات المكررة في: $dupDir"
    Write-Info "الملف الأصلي بقي في مكانه. التكرارات نُقلت فقط."
} else {
    Write-Success "لا يوجد ملفات متكررة! 🎉"
}

# إذا كان المطلوب فقط التكرارات، نتوقف هنا
if ($DuplicatesOnly) {
    Write-Header "📊 ملخص العملية"
    Write-Info "الملفات المفحوصة: $total"
    Write-Info "التكرارات المعزولة: $($stats.MovedToTrash)"
    Write-Info "الأخطاء: $($stats.Errors)"
    Write-Host "`nتم بنجاح! ✅" -ForegroundColor Green
    exit 0
}

# =============================================
#  التنظيم حسب النوع والتاريخ
# =============================================

Write-Header "3️⃣  تنظيم الملفات حسب النوع والتاريخ..."

$organizedDir = Join-Path $baseDir "_Organized"
if (-not $DryRun -and -not (Test-Path $organizedDir)) {
    New-Item -ItemType Directory -Path $organizedDir -Force | Out-Null
}

# إعادة جمع الملفات بعد نقل التكرارات
$filesToOrganize = Get-ChildItem -Path $baseDir -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
    $_.FullName -notmatch "\\_Trash\\" -and
    $_.FullName -notmatch "\\_Organized\\" -and
    $_.FullName -notmatch "\\_Duplicates\\"
}

$counter = 0
foreach ($file in $filesToOrganize) {
    $counter++
    Write-Progress -Activity "تنظيم الملفات" -Status "$counter / $($filesToOrganize.Count)" -PercentComplete (($counter/$filesToOrganize.Count)*100)

    $category = Get-Category -file $file
    $year = $file.LastWriteTime.Year.ToString()
    $month = $file.LastWriteTime.ToString("MM-MMMM")

    $targetDir = Join-Path $organizedDir $category $year $month
    $targetPath = Join-Path $targetDir $file.Name

    # تجنب التسمية المتكررة
    $suffix = 1
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $ext = $file.Extension
    while (Test-Path $targetPath) {
        $targetPath = Join-Path $targetDir "${baseName}_($suffix)${ext}"
        $suffix++
    }

    if (-not $DryRun) {
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        try {
            Move-Item -Path $file.FullName -Destination $targetPath -Force
            $stats.Organized++
            if (-not $stats.Categories.ContainsKey($category)) {
                $stats.Categories[$category] = 0
            }
            $stats.Categories[$category]++
        } catch {
            $stats.Errors++
        }
    } else {
        $stats.Organized++
        if (-not $stats.Categories.ContainsKey($category)) {
            $stats.Categories[$category] = 0
        }
        $stats.Categories[$category]++
    }
}

# =============================================
#  إنشاء تقرير
# =============================================

Write-Header "4️⃣  إنشاء التقرير..."

$reportPath = Join-Path $baseDir "_Organizer_Report.txt"
$reportContent = @"
========================================
   تقرير تنظيم الملفات - Bonds Organizer
   التاريخ: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================

المسار: $baseDir
الوضع الجاف (Dry Run): $($DryRun)

--- الإحصائيات ---
الملفات المفحوصة:      $total
التكرارات المعزولة:    $($stats.MovedToTrash)
الملفات المنظمة:       $($stats.Organized)
الأخطاء:               $($stats.Errors)

--- التوزيع حسب النوع ---
"@

foreach ($cat in $stats.Categories.Keys | Sort-Object) {
    $reportContent += "`n  - ${cat}: $($stats.Categories[$cat]) ملف"
}

$reportContent += "`

--- المجلدات التي تم إنشاؤها ---
_Origanized/      <- الملفات المنظمة
_Duplicates/      <- الملفات المكررة

========================================
تم إنشاء هذا التقرير تلقائياً.
========================================
"@

if (-not $DryRun) {
    $reportContent | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Success "تم حفظ التقرير في: $reportPath"
}

# =============================================
#  النهاية
# =============================================

Write-Progress -Activity "تم" -Completed
Write-Header "📊 ملخص العملية"

Write-Host "  📁 الملفات المفحوصة:     " -NoNewline; Write-Host $total -ForegroundColor Cyan
Write-Host "  🔁 التكرارات المعزولة:    " -NoNewline; Write-Host $stats.MovedToTrash -ForegroundColor Yellow
Write-Host "  📂 الملفات المنظمة:      " -NoNewline; Write-Host $stats.Organized -ForegroundColor Green
Write-Host "  ❌ الأخطاء:              " -NoNewline; Write-Host $stats.Errors -ForegroundColor $(if ($stats.Errors -gt 0) { "Red" } else { "Green" })

Write-Host "`n📂 التوزيع:" -ForegroundColor $colors.Accent
foreach ($cat in $stats.Categories.Keys | Sort-Object) {
    $icon = switch ($cat) {
        "Images"     { "🖼️" }
        "Videos"     { "🎬" }
        "Audio"      { "🎵" }
        "Documents"  { "📄" }
        "Archives"   { "🗜️" }
        "Apps"       { "💿" }
        "Design"     { "🎨" }
        "Code"       { "💻" }
        default      { "📦" }
    }
    Write-Host "   $icon $cat`: $($stats.Categories[$cat])" -ForegroundColor $colors.Info
}

if ($DryRun) {
    Write-Warn "`n⚠️ هذا كان وضع المحاكاة فقط (Dry Run)."
    Write-Info "للتنفيذ الفعلي، شغل السكربت بدون معامل -DryRun"
    Write-Host "   مثال: .\organize-files.ps1 -TargetPath '$baseDir'" -ForegroundColor DarkGray
} else {
    Write-Success "`n✅ تم التنظيم بنجاح!"
    Write-Info "المجلدات الجديدة:"
    Write-Host "   📂 _Organized/  -> ملفاتك المنظمة" -ForegroundColor Green
    Write-Host "   📂 _Duplicates/ -> التكرارات المعزولة" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor $colors.Header
