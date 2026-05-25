#!/usr/bin/env python3
"""
Collect all programs/apps into Desktop\البرامج\
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

HOME = Path.home()
TARGET = HOME / "Desktop" / "البرامج"

EXCLUDE_DIRS = {"node_modules", ".git", ".vscode", "appdata", "cache", "temp", "infrastructure", "sources", "replacementmanifests", "dlmanifests", "windows", "system32"}
EXCLUDE_NAMES = {"setup.exe", "setup", "install", "installer"}  # We want these but not system paths

# File extensions for programs
PROG_EXTS = {".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".appx", ".msix"}

# Folder keywords
FOLDER_KEYWORDS = ["adobe", "office", "photoshop", "برنامج", "برامج", "تعريف", "طابعة", "اسكنر", "اوفيس", "whatsapp", "docker", "android", "git", "visual", "crystal", "rufus", "capcut", "burp", "libre", "manageengine", "tiktok", "trae", "ollama", "laragon", "studio"]

def should_exclude_dir(path):
    lower = str(path).lower()
    return any(x in lower for x in EXCLUDE_DIRS)

def is_program_folder(name):
    lower = name.lower()
    return any(kw in lower for kw in FOLDER_KEYWORDS)

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

def safe_copytree(src, dst):
    dst = Path(dst)
    if dst.exists():
        counter = 1
        while dst.exists():
            dst = dst.parent / f"{dst.name}_({counter})"
            counter += 1
    try:
        shutil.copytree(str(src), str(dst))
        return True
    except Exception as e:
        print(f"  FAIL: {src.name} -> {e}")
        return False

def main():
    print("=" * 60)
    print("  Program Collection - جمع البرامج")
    print("=" * 60)
    print(f"  Target: {TARGET}")
    print()

    TARGET.mkdir(parents=True, exist_ok=True)

    search_roots = [
        HOME / "Desktop",
        HOME / "Documents",
        HOME / "Downloads",
        HOME / "OneDrive" / "Desktop",
        HOME / "OneDrive" / "Documents",
        Path("C:/BondsCleanup"),
    ]

    found_files = []
    found_dirs = []

    for root in search_roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            # Skip excluded dirs
            dirnames[:] = [d for d in dirnames if not should_exclude_dir(Path(dirpath) / d)]
            current = Path(dirpath)
            if should_exclude_dir(current):
                continue
            if current == TARGET or TARGET in current.parents:
                continue

            # Check folder name
            if is_program_folder(current.name):
                # Make sure it's not too deep inside another found dir
                if not any(current in fd.parents or fd in current.parents for fd in found_dirs):
                    found_dirs.append(current)
                    # Don't walk inside this dir further (we'll copy whole tree)
                    dirnames[:] = []
                    continue

            # Check files
            for filename in filenames:
                ext = Path(filename).suffix.lower()
                if ext in PROG_EXTS:
                    file_path = current / filename
                    if file_path.stat().st_size > 1024 * 1024:  # > 1MB
                        found_files.append(file_path)

    print(f"  Program folders found: {len(found_dirs)}")
    for d in found_dirs:
        print(f"    [FOLDER] {d}")

    print(f"\n  Program files found: {len(found_files)}")

    # Copy folders
    copied_dirs = 0
    failed_dirs = 0
    for src_dir in found_dirs:
        try:
            rel = src_dir.relative_to(HOME)
        except ValueError:
            try:
                rel = src_dir.relative_to(Path("C:/"))
            except ValueError:
                rel = src_dir.name
        dst = TARGET / rel
        if safe_copytree(src_dir, dst):
            copied_dirs += 1
        else:
            failed_dirs += 1

    # Copy files
    copied_files = 0
    failed_files = 0
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
            copied_files += 1
            total_size += src.stat().st_size
        else:
            failed_files += 1

    print("\n" + "=" * 60)
    print("  Done!")
    print("=" * 60)
    print(f"  Folders copied: {copied_dirs}")
    print(f"  Files copied: {copied_files}")
    print(f"  Total failed: {failed_dirs + failed_files}")
    print(f"  Total size: {total_size / (1024**3):.2f} GB")
    print(f"  Target: {TARGET}")
    print("=" * 60)

    log = HOME / f"Desktop/Programs_Collection_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log, "w", encoding="utf-8") as f:
        f.write("Programs Collection Log\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now()}\n\n")
        f.write(f"Folders found: {len(found_dirs)}\n")
        for d in found_dirs:
            f.write(f"  [DIR] {d}\n")
        f.write(f"\nFiles found: {len(found_files)}\n")
        for fp in found_files:
            f.write(f"  [FILE] {fp}\n")
        f.write(f"\nCopied: {copied_dirs} dirs, {copied_files} files\n")
        f.write(f"Failed: {failed_dirs + failed_files}\n")
        f.write(f"Total size: {total_size / (1024**3):.2f} GB\n")
        f.write(f"\nTarget: {TARGET}\n")
        f.write("=" * 50 + "\n")
    print(f"\nLog saved: {log}")

if __name__ == "__main__":
    main()
