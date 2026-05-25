#!/usr/bin/env python3
"""
Bonds File Organizer - Organize remaining files on C:
Sorts by type/year/month into _Organized/ folders
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
from collections import defaultdict

FOLDERS = [
    Path.home() / "Downloads",
    Path.home() / "Desktop",
    Path.home() / "Documents",
    Path.home() / "Pictures",
    Path.home() / "Videos",
]

EXCLUDE = {"_organized", "_duplicates", "appdata", "onedrive", "temp", "cache", ".git", "node_modules", "venv", ".venv"}
ORG_DIR = "_Organized"


def get_category(ext):
    e = ext.lower()
    images = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".ico", ".heic", ".raw", ".svg"}
    videos = {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"}
    audio = {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"}
    docs = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv", ".md"}
    archives = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".iso"}
    apps = {".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".appx"}
    code = {".py", ".js", ".ts", ".html", ".css", ".java", ".cpp", ".c", ".cs", ".php", ".go", ".rs", ".sql"}
    design = {".psd", ".ai", ".xd", ".sketch", ".fig", ".aep", ".prproj"}
    if e in images: return "Images"
    if e in videos: return "Videos"
    if e in audio: return "Audio"
    if e in docs: return "Documents"
    if e in archives: return "Archives"
    if e in apps: return "Apps"
    if e in code: return "Code"
    if e in design: return "Design"
    return "Others"


def safe_move(src, dst):
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    counter = 1
    final_dst = dst
    while final_dst.exists():
        final_dst = dst.parent / f"{dst.stem}_({counter}){dst.suffix}"
        counter += 1
    try:
        shutil.move(str(src), str(final_dst))
        return True
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def should_exclude(path):
    return any(x in str(path).lower() for x in EXCLUDE)


def main():
    print("=" * 55)
    print("  Bonds File Organizer - Remaining Files")
    print("=" * 55)
    print("  Sorting by: Type / Year / Month")
    print()

    total_files = 0
    total_moved = 0
    total_failed = 0
    total_skipped = 0
    by_category = defaultdict(int)

    for folder in FOLDERS:
        if not folder.exists():
            continue

        print(f"Scanning: {folder.name}")
        files = []
        for root, dirs, filenames in os.walk(folder):
            # Remove excluded dirs from walk
            dirs[:] = [d for d in dirs if not should_exclude(Path(root) / d)]
            for name in filenames:
                filepath = Path(root) / name
                if should_exclude(filepath):
                    continue
                if not filepath.exists():
                    continue
                files.append(filepath)

        moved = 0
        failed = 0
        skipped = 0

        for i, filepath in enumerate(files):
            if (i + 1) % 500 == 0:
                print(f"  {i+1}/{len(files)} processed...")

            try:
                stat = filepath.stat()
                mtime = datetime.fromtimestamp(stat.st_mtime)
            except (OSError, PermissionError):
                skipped += 1
                continue

            category = get_category(filepath.suffix)
            year = mtime.strftime("%Y")
            month = mtime.strftime("%m-%B")

            base_dir = filepath.parent
            org_dir = base_dir / ORG_DIR / category / year / month
            dest = org_dir / filepath.name

            # Don't move if already in _Organized
            if ORG_DIR in str(filepath):
                skipped += 1
                continue

            if safe_move(filepath, dest):
                moved += 1
                by_category[category] += 1
            else:
                failed += 1

        print(f"  Moved: {moved} | Failed: {failed} | Skipped: {skipped}")
        total_files += len(files)
        total_moved += moved
        total_failed += failed
        total_skipped += skipped

    print("\n" + "=" * 55)
    print("  ORGANIZATION COMPLETE")
    print("=" * 55)
    print(f"  Total files scanned: {total_files}")
    print(f"  Files organized:     {total_moved}")
    print(f"  Failed:              {total_failed}")
    print(f"  Skipped:             {total_skipped}")
    print("\n  By category:")
    for cat, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
        print(f"    {cat}: {count} files")
    print("=" * 55)

    # Log
    log = Path.home() / f"Desktop/BondsOrganize_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log, "w", encoding="utf-8") as f:
        f.write("Bonds File Organizer Log\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now()}\n")
        f.write(f"Total scanned: {total_files}\n")
        f.write(f"Organized: {total_moved}\n")
        f.write(f"Failed: {total_failed}\n")
        f.write(f"Skipped: {total_skipped}\n\n")
        f.write("By category:\n")
        for cat, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
            f.write(f"  {cat}: {count}\n")
        f.write("\n" + "=" * 50 + "\n")
    print(f"\nLog saved: {log}")


if __name__ == "__main__":
    main()
