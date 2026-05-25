#!/usr/bin/env python3
"""
Bonds Duplicate Scanner - Saves results to JSON for PowerShell execution
"""

import os
import sys
import hashlib
import json
import time
from pathlib import Path
from collections import defaultdict
from multiprocessing import Pool, cpu_count
from datetime import datetime

FOLDERS = [
    (Path.home() / "Downloads", "Downloads"),
    (Path.home() / "Desktop", "Desktop"),
    (Path.home() / "Documents", "Documents"),
    (Path.home() / "Pictures", "Pictures"),
    (Path.home() / "Videos", "Videos"),
]

EXCLUDE_PATTERNS = {"appdata", "onedrive", "temp", "cache", ".git", "node_modules", "venv", ".venv", "_organized", "_duplicates"}
MIN_FILE_SIZE = 1


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
                        "mtime": mtime.isoformat(),
                        "ext": filepath.suffix.lower(),
                        "source": source_name,
                        "dir": str(filepath.parent),
                    })
                except (OSError, PermissionError):
                    continue
    except Exception as e:
        print(f"   Warning scanning {source_name}: {e}")
    return files


def main():
    print("=" * 50)
    print("  Bonds Duplicate Scanner - JSON Export")
    print("=" * 50)

    all_files = []
    for folder_path, source_name in FOLDERS:
        if not folder_path.exists():
            continue
        items = scan_folder(folder_path, source_name)
        print(f"   {source_name}: {len(items)} files")
        all_files.extend(items)

    total_files = len(all_files)
    print(f"\nTOTAL: {total_files} files")

    if total_files == 0:
        print("No files found!")
        sys.exit(1)

    print("\nGrouping by size...")
    size_groups = defaultdict(list)
    for f in all_files:
        size_groups[f["size"]].append(f)

    suspects = []
    for size, group in size_groups.items():
        if len(group) > 1:
            suspects.extend(group)

    print(f"   Suspects: {len(suspects)}")

    duplicates = []
    if suspects:
        print(f"Hashing {len(suspects)} suspects using {cpu_count()} cores...")
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
            originals = [group[0]]
            dups = group[1:]
            for d in dups:
                duplicates.append({
                    "original": group[0]["path"],
                    "duplicate": d["path"],
                    "name": d["name"],
                    "size": d["size"],
                    "source": d["source"],
                    "original_source": group[0]["source"],
                })

    print(f"\nFound {len(duplicates)} duplicate files to move.")

    # Save JSON
    output = {
        "scan_date": datetime.now().isoformat(),
        "total_files": total_files,
        "duplicate_count": len(duplicates),
        "duplicates": duplicates,
        "all_files": all_files,
    }

    json_path = Path("duplicates.json").resolve()
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Saved to: {json_path}")
    print("Ready for PowerShell execution.")


if __name__ == "__main__":
    main()
