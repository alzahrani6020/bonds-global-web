#!/usr/bin/env python3
"""
Bonds File Organizer - Actual Execution
Moves duplicates to D:\BondsCleanup\Duplicates\ and organizes the rest
"""

import os
import sys
import shutil
import hashlib
import time
from pathlib import Path
from collections import defaultdict
from multiprocessing import Pool, cpu_count
from datetime import datetime

# Config
DUPLICATE_TARGET = Path("D:/BondsCleanup/Duplicates")
ORGANIZED_SUBDIR = "_Organized"
MIN_FILE_SIZE = 1

FOLDERS = [
    (Path.home() / "Downloads", "Downloads"),
    (Path.home() / "Desktop", "Desktop"),
    (Path.home() / "Documents", "Documents"),
    (Path.home() / "Pictures", "Pictures"),
    (Path.home() / "Videos", "Videos"),
]

EXCLUDE_PATTERNS = {"appdata", "onedrive", "temp", "cache", ".git", "node_modules", "venv", ".venv", "_organized", "_duplicates"}


def format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(size_bytes) < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def should_exclude(path):
    lower = str(path).lower()
    return any(pat in lower for pat in EXCLUDE_PATTERNS)


def md5_file(filepath):
    try:
        h = hashlib.md5()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return str(filepath), h.hexdigest()
    except Exception:
        return str(filepath), None


def scan_folder(folder_path, source_name):
    files = []
    try:
        for root, dirs, filenames in os.walk(folder_path):
            dirs[:] = [d for d in dirs if not should_exclude(Path(root) / d)]
            for filename in filenames:
                filepath = Path(root) / filename
                if should_exclude(filepath):
                    continue
                try:
                    stat = filepath.stat()
                    size = stat.st_size
                    if size < MIN_FILE_SIZE:
                        continue
                    mtime = datetime.fromtimestamp(stat.st_mtime)
                    files.append({
                        "path": str(filepath),
                        "name": filename,
                        "size": size,
                        "mtime": mtime,
                        "ext": filepath.suffix.lower(),
                        "source": source_name,
                        "dir": str(filepath.parent),
                    })
                except (OSError, PermissionError):
                    continue
    except Exception as e:
        print(f"   Warning scanning {source_name}: {e}")
    return files


def get_category(ext):
    ext = ext.lower()
    images = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".ico", ".heic", ".raw", ".svg"}
    videos = {".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"}
    audio = {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"}
    docs = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv", ".md"}
    archives = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".iso"}
    apps = {".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".appx"}
    code = {".py", ".js", ".ts", ".html", ".css", ".java", ".cpp", ".c", ".cs", ".php", ".go", ".rs", ".sql"}
    design = {".psd", ".ai", ".xd", ".sketch", ".fig", ".aep", ".prproj"}
    if ext in images: return "Images"
    if ext in videos: return "Videos"
    if ext in audio: return "Audio"
    if ext in docs: return "Documents"
    if ext in archives: return "Archives"
    if ext in apps: return "Apps"
    if ext in code: return "Code"
    if ext in design: return "Design"
    return "Others"


def safe_move(src, dst):
    """Move file, handle name collisions."""
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        stem = dst.stem
        suffix = dst.suffix
        counter = 1
        while dst.exists():
            dst = dst.parent / f"{stem}_({counter}){suffix}"
            counter += 1
    try:
        shutil.move(str(src), str(dst))
        return True
    except Exception as e:
        print(f"      ERROR moving {src}: {e}")
        return False


def main():
    print("=" * 55)
    print("  Bonds File Organizer - ACTUAL EXECUTION")
    print("=" * 55)
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Target: {DUPLICATE_TARGET}")
    print()

    # Verify D: exists
    if not Path("D:/").exists():
        print("ERROR: D: drive not found! Please connect the hard disk.")
        sys.exit(1)

    DUPLICATE_TARGET.mkdir(parents=True, exist_ok=True)

    # Scan
    print("Scanning folders...")
    all_files = []
    for folder_path, source_name in FOLDERS:
        if not folder_path.exists():
            print(f"   {source_name}: Not found, skipping.")
            continue
        items = scan_folder(folder_path, source_name)
        total_size = sum(f["size"] for f in items)
        print(f"   {source_name}: {len(items)} files ({format_size(total_size)})")
        all_files.extend(items)

    total_files = len(all_files)
    print(f"\nTOTAL: {total_files} files")

    if total_files == 0:
        print("No files to process!")
        return

    # Group by size
    print("\nStep 1: Finding duplicates by size...")
    size_groups = defaultdict(list)
    for f in all_files:
        size_groups[f["size"]].append(f)

    suspects = []
    for size, group in size_groups.items():
        if len(group) > 1:
            suspects.extend(group)

    print(f"   Suspect files: {len(suspects)}")

    duplicates_to_move = []
    files_to_organize = list(all_files)

    if suspects:
        print(f"\nStep 2: Hashing {len(suspects)} suspects using {cpu_count()} cores...")
        start = time.time()
        paths = [f["path"] for f in suspects]
        with Pool(processes=cpu_count()) as pool:
            results = pool.map(md5_file, paths)

        hash_map = defaultdict(list)
        for filepath, filehash in results:
            if filehash:
                hash_map[filehash].append(filepath)

        elapsed = time.time() - start
        print(f"   Hashed in {elapsed:.1f}s")

        file_info = {f["path"]: f for f in all_files}

        for filehash, paths in hash_map.items():
            if len(paths) < 2:
                continue
            group = sorted([file_info[p] for p in paths if p in file_info], key=lambda x: x["mtime"])
            if len(group) < 2:
                continue
            # Keep oldest as original, move the rest
            original = group[0]
            for dup in group[1:]:
                duplicates_to_move.append(dup)
                # Remove from organize list
                files_to_organize = [f for f in files_to_organize if f["path"] != dup["path"]]

    # Move duplicates
    print(f"\nStep 3: Moving {len(duplicates_to_move)} duplicates to D:\BondsCleanup\Duplicates\...")
    moved_count = 0
    moved_size = 0
    failed_count = 0

    for i, dup in enumerate(duplicates_to_move):
        if (i + 1) % 100 == 0:
            print(f"   Progress: {i+1}/{len(duplicates_to_move)}")

        src_path = Path(dup["path"])
        # Preserve relative structure under target
        rel_path = src_path.relative_to(Path.home())
        dst_path = DUPLICATE_TARGET / rel_path

        if safe_move(src_path, dst_path):
            moved_count += 1
            moved_size += dup["size"]
        else:
            failed_count += 1

    print(f"   Moved: {moved_count} files ({format_size(moved_size)})")
    if failed_count:
        print(f"   Failed: {failed_count} files")

    # Organize remaining files
    print(f"\nStep 4: Organizing {len(files_to_organize)} remaining files...")
    org_count = 0
    org_failed = 0

    for i, f in enumerate(files_to_organize):
        if (i + 1) % 500 == 0:
            print(f"   Progress: {i+1}/{len(files_to_organize)}")

        src_path = Path(f["path"])
        base_dir = src_path.parent
        category = get_category(f["ext"])
        year = f["mtime"].strftime("%Y")
        month = f["mtime"].strftime("%m-%B")

        org_dir = base_dir / ORGANIZED_SUBDIR / category / year / month
        dst_path = org_dir / f["name"]

        if safe_move(src_path, dst_path):
            org_count += 1
        else:
            org_failed += 1

    print(f"   Organized: {org_count} files")
    if org_failed:
        print(f"   Failed: {org_failed} files")

    # Summary
    print("\n" + "=" * 55)
    print("  EXECUTION COMPLETE")
    print("=" * 55)
    print(f"  Duplicates moved:   {moved_count} files ({format_size(moved_size)})")
    print(f"  Files organized:    {org_count} files")
    print(f"  Failed operations:  {failed_count + org_failed}")
    print(f"\n  Location:")
    print(f"     D:\BondsCleanup\Duplicates\  <- Your duplicate files")
    print(f"     _Organized\  <- Remaining files sorted by type/date")
    print("\n  Space saved on C: drive: " + format_size(moved_size))
    print("=" * 55)

    # Save log
    log_path = Path.home() / f"Desktop/BondsCleanup_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log_path, "w", encoding="utf-8") as log:
        log.write("Bonds File Organizer - Execution Log\n")
        log.write("=" * 50 + "\n")
        log.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        log.write(f"Duplicates moved: {moved_count} ({format_size(moved_size)})\n")
        log.write(f"Files organized: {org_count}\n")
        log.write(f"Failed: {failed_count + org_failed}\n\n")
        log.write("Duplicates moved to:\n")
        log.write(str(DUPLICATE_TARGET) + "\n\n")
        log.write("Sample of moved duplicates:\n")
        for dup in duplicates_to_move[:50]:
            log.write(f"  {dup['path']} ({format_size(dup['size'])})\n")
        log.write("\n" + "=" * 50 + "\n")

    print(f"\nLog saved to: {log_path}")


if __name__ == "__main__":
    main()
