#!/usr/bin/env python3
"""
Bonds Duplicate Scanner v3 - Python Edition
Fast parallel duplicate detection using MD5
"""

import os
import sys
import hashlib
import time
from pathlib import Path
from collections import defaultdict
from multiprocessing import Pool, cpu_count
from datetime import datetime

# Folders to scan
FOLDERS = [
    (Path.home() / "Downloads", "Downloads"),
    (Path.home() / "Desktop", "Desktop"),
    (Path.home() / "Documents", "Documents"),
    (Path.home() / "Pictures", "Pictures"),
    (Path.home() / "Videos", "Videos"),
]

EXCLUDE_PATTERNS = {"appdata", "onedrive", "temp", "cache", ".git", "node_modules", "venv", ".venv"}
MIN_FILE_SIZE = 1  # bytes


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
    """Calculate MD5 hash of a file quickly."""
    try:
        h = hashlib.md5()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return str(filepath), h.hexdigest()
    except Exception:
        return str(filepath), None


def scan_folder(folder_path, source_name):
    """Collect all files from a folder."""
    files = []
    try:
        for root, dirs, filenames in os.walk(folder_path):
            # Skip excluded directories
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
        print(f"   Warning: Error scanning {source_name}: {e}")
    return files


def main():
    print("=" * 50)
    print("  Bonds Duplicate Scanner v3 - Python")
    print("  Mode: DRY RUN (Simulation only)")
    print("=" * 50)
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  CPU cores: {cpu_count()}")
    print(f"  Algorithm: MD5 (parallel)")
    print()

    # Scan all folders
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
    total_size = sum(f["size"] for f in all_files)
    print(f"\nTOTAL: {total_files} files ({format_size(total_size)})")

    if total_files == 0:
        print("No files to scan!")
        return

    # Step 1: Group by size
    print("\nStep 1: Grouping by file size...")
    size_groups = defaultdict(list)
    for f in all_files:
        size_groups[f["size"]].append(f)

    suspects = []
    for size, group in size_groups.items():
        if len(group) > 1:
            suspects.extend(group)

    print(f"   Potential groups: {sum(1 for g in size_groups.values() if len(g) > 1)}")
    print(f"   Suspect files: {len(suspects)}")

    if not suspects:
        print("\nNo duplicates found! All files have unique sizes.")
        return

    # Step 2: Hash suspects in parallel
    print(f"\nStep 2: Hashing {len(suspects)} suspect files using {cpu_count()} cores...")
    start_time = time.time()

    paths = [f["path"] for f in suspects]
    with Pool(processes=cpu_count()) as pool:
        results = pool.map(md5_file, paths)

    hash_map = defaultdict(list)
    failed = 0
    for filepath, filehash in results:
        if filehash:
            hash_map[filehash].append(filepath)
        else:
            failed += 1

    elapsed = time.time() - start_time
    print(f"   Hashed in {elapsed:.1f} seconds")
    print(f"   Failed: {failed}")

    # Step 3: Build duplicate groups with metadata
    duplicate_groups = []
    dup_by_source = defaultdict(lambda: {"count": 0, "size": 0})
    dup_by_type = defaultdict(lambda: {"count": 0, "size": 0})
    total_dup_count = 0
    total_dup_size = 0
    top_dups = []

    file_info = {f["path"]: f for f in all_files}

    for filehash, paths in hash_map.items():
        if len(paths) < 2:
            continue

        group = sorted([file_info[p] for p in paths if p in file_info], key=lambda x: x["mtime"])
        if len(group) < 2:
            continue

        duplicate_groups.append(group)
        original = group[0]

        for dup in group[1:]:
            total_dup_count += 1
            total_dup_size += dup["size"]
            dup_by_source[dup["source"]]["count"] += 1
            dup_by_source[dup["source"]]["size"] += dup["size"]
            ext = dup["ext"] if dup["ext"] else "(no ext)"
            dup_by_type[ext]["count"] += 1
            dup_by_type[ext]["size"] += dup["size"]
            top_dups.append({
                "name": dup["name"],
                "size": dup["size"],
                "source": dup["source"],
                "original": original["source"],
                "path": dup["path"],
            })

    # Results display
    print("\n" + "=" * 50)
    print("  SCAN RESULTS (DRY RUN)")
    print("=" * 50)
    print(f"  Files scanned:       {total_files}")
    print(f"  Suspects checked:    {len(suspects)}")
    print(f"  Failed hashes:       {failed}")
    print(f"  Duplicate groups:    {len(duplicate_groups)}")
    print(f"  Duplicate files:     {total_dup_count}")
    print(f"  Space recoverable:   {format_size(total_dup_size)}")

    print("\nDuplicates by folder:")
    if not dup_by_source:
        print("   (none)")
    else:
        for src in sorted(dup_by_source.keys()):
            info = dup_by_source[src]
            print(f"   {src}: {info['count']} files ({format_size(info['size'])})")

    print("\nDuplicates by type (top 10):")
    if not dup_by_type:
        print("   (none)")
    else:
        sorted_types = sorted(dup_by_type.items(), key=lambda x: x[1]["size"], reverse=True)[:10]
        for ext, info in sorted_types:
            print(f"   {ext}: {info['count']} files ({format_size(info['size'])})")

    if top_dups:
        top_dups.sort(key=lambda x: x["size"], reverse=True)
        print("\nTop 10 largest duplicates:")
        for d in top_dups[:10]:
            print(f"   {format_size(d['size'])} | {d['name']}")
            print(f"      Original: {d['original']} | Duplicate: {d['source']}")

    # Sample groups
    print("\n" + "=" * 50)
    print("  SAMPLE GROUPS")
    print("=" * 50)
    if not duplicate_groups:
        print("   No duplicate groups to display.")
    else:
        for group in duplicate_groups[:5]:
            orig = group[0]
            print(f"\n  FILE: {orig['name']} ({format_size(orig['size'])})")
            for f in group:
                marker = "[ORIGINAL]" if f == orig else "[DUPLICATE]"
                print(f"     {marker} [{f['source']}] {f['path']}")

    # Recommendation
    print("\n" + "=" * 50)
    print("  RECOMMENDATION")
    print("=" * 50)
    if total_dup_count == 0:
        print("  No duplicates found! Your PC is clean.")
    else:
        print("  If you run the actual cleanup:")
        print(f"     - {total_dup_count} duplicate files will move to D:\\BondsCleanup\\Duplicates\\")
        print(f"     - You will save {format_size(total_dup_size)} of space!")
        print("     - Original files stay in place")
        print("\n  Next step: Run the actual organizer")

    # Save report
    report_path = Path.home() / f"Desktop/DuplicateScan_Report_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("=" * 50 + "\n")
        f.write("   Duplicate Scan Report - Bonds Scanner v3\n")
        f.write(f"   Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("   MODE: DRY RUN (Simulation only)\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Files scanned:      {total_files}\n")
        f.write(f"Suspects checked:   {len(suspects)}\n")
        f.write(f"Failed hashes:      {failed}\n")
        f.write(f"Duplicate groups:   {len(duplicate_groups)}\n")
        f.write(f"Duplicate files:    {total_dup_count}\n")
        f.write(f"Space recoverable:  {format_size(total_dup_size)}\n\n")

        f.write("--- Duplicates by folder ---\n")
        for src in sorted(dup_by_source.keys()):
            info = dup_by_source[src]
            f.write(f"{src}: {info['count']} files ({format_size(info['size'])})\n")

        f.write("\n--- Duplicates by type (top 10) ---\n")
        for ext, info in sorted_types:
            f.write(f"{ext}: {info['count']} files ({format_size(info['size'])})\n")

        f.write("\n--- Sample groups ---\n")
        for group in duplicate_groups[:10]:
            orig = group[0]
            f.write(f"\nFILE: {orig['name']} ({format_size(orig['size'])})\n")
            for fl in group:
                marker = "ORIGINAL" if fl == orig else "DUPLICATE"
                f.write(f"  [{marker}] [{fl['source']}] {fl['path']}\n")

        f.write("\n" + "=" * 50 + "\n")

    print(f"\nFull report saved to:\n   {report_path}")
    print("\n" + "=" * 50)
    print("  DRY RUN COMPLETE")
    print("=" * 50)


if __name__ == "__main__":
    main()
