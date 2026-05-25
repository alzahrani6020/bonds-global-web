#!/usr/bin/env python3
"""
Collect all files related to "الصندوق" (Al-Sanduq)
Search and copy to Desktop\الصندوق-المجمع\
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

HOME = Path.home()
TARGET = HOME / "Desktop" / "الصندوق-المجمع"
KEYWORDS = ["صندوق", "الصندوق"]
EXCLUDE = {"appdata", "recent", "cache", "temp", "_organized", "bonds-global-web", ".git", "node_modules"}

def contains_keyword(name):
    lower = name.lower()
    return any(kw in lower for kw in KEYWORDS)

def should_exclude(path):
    return any(x in str(path).lower() for x in EXCLUDE)

def safe_copy(src, dst):
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    counter = 1
    final_dst = dst
    while final_dst.exists():
        final_dst = dst.parent / f"{dst.stem}_({counter}){dst.suffix}"
        counter += 1
    try:
        shutil.copy2(str(src), str(final_dst))
        return True
    except Exception as e:
        print(f"  FAIL: {src.name} -> {e}")
        return False

def main():
    print("=" * 60)
    print("  Sanduq File Collector")
    print("=" * 60)
    print(f"  Target: {TARGET}")
    print()

    TARGET.mkdir(parents=True, exist_ok=True)

    # Search paths
    search_roots = [
        HOME / "Desktop",
        HOME / "Documents",
        HOME / "Downloads",
        HOME / "Pictures",
        HOME / "Videos",
        HOME / "OneDrive" / "Desktop",
        HOME / "OneDrive" / "Documents",
        Path("C:/BondsCleanup"),
    ]

    found_dirs = []
    found_files = []

    for root in search_roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            # Skip excluded directories
            dirnames[:] = [d for d in dirnames if not should_exclude(Path(dirpath) / d)]

            current_path = Path(dirpath)
            if should_exclude(current_path):
                continue
            if current_path == TARGET or TARGET in current_path.parents:
                continue

            # Check directory name
            if contains_keyword(current_path.name):
                if current_path not in found_dirs:
                    found_dirs.append(current_path)

            # Check files
            for filename in filenames:
                if contains_keyword(filename):
                    file_path = current_path / filename
                    if not should_exclude(file_path):
                        found_files.append(file_path)

    print(f"  مجلدات وجدت: {len(found_dirs)}")
    for d in found_dirs:
        print(f"    [DIR] {d}")

    print(f"\n  ملفات وجدت: {len(found_files)}")

    # Copy files
    copied = 0
    failed = 0
    total_size = 0

    for src in found_files:
        try:
            rel = src.relative_to(HOME)
        except ValueError:
            try:
                rel = src.relative_to(Path("C:/"))
            except ValueError:
                rel = src.name

        dst = TARGET / rel
        if safe_copy(src, dst):
            copied += 1
            total_size += src.stat().st_size
        else:
            failed += 1

    # Copy directories content (files inside Sanduq folders)
    for src_dir in found_dirs:
        print(f"\n  Copying content: {src_dir.name}")
        for dirpath, dirnames, filenames in os.walk(src_dir):
            dirnames[:] = [d for d in dirnames if not should_exclude(Path(dirpath) / d)]
            for filename in filenames:
                src_file = Path(dirpath) / filename
                if should_exclude(src_file):
                    continue
                try:
                    rel = src_file.relative_to(HOME)
                except ValueError:
                    try:
                        rel = src_file.relative_to(Path("C:/"))
                    except ValueError:
                        rel = src_file.name

                dst = TARGET / rel
                if not dst.exists():
                    if safe_copy(src_file, dst):
                        copied += 1
                        total_size += src_file.stat().st_size
                    else:
                        failed += 1

    # Summary
    print("\n" + "=" * 60)
    print("  تم الانتهاء!")
    print("=" * 60)
    print(f"  مجلدات: {len(found_dirs)}")
    print(f"  ملفات تم نسخها: {copied}")
    print(f"  فشل: {failed}")
    print(f"  الحجم الإجمالي: {total_size / (1024**2):.2f} MB")
    print(f"\n  Target: {TARGET}")
    print("=" * 60)

    # Log
    log = HOME / f"Desktop/Sanduq_Collection_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log, "w", encoding="utf-8") as f:
        f.write("Sanduq Collection Log\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now()}\n\n")
        f.write(f"Directories found: {len(found_dirs)}\n")
        for d in found_dirs:
            f.write(f"  [DIR] {d}\n")
        f.write(f"\nFiles copied: {copied}\n")
        f.write(f"Failed: {failed}\n")
        f.write(f"Total size: {total_size / (1024**2):.2f} MB\n")
        f.write(f"\nTarget: {TARGET}\n")
        f.write("=" * 50 + "\n")
    print(f"\nLog saved: {log}")

if __name__ == "__main__":
    main()
