#!/usr/bin/env python3
"""
Collect files related to WIPO / منظمة الامم المتحدة لحفظ الحقوق
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

HOME = Path.home()
TARGET = HOME / "Desktop" / "منظمة-الامم-المتحدة-لحفظ-الحقوق"

KEYWORDS = ["امم", "حقوق", "ملكية", "فكرية", "فكربه", "wipo", "united nations", "intellectual"]
EXCLUDE = {"node_modules", ".vscode", "appdata", "cache", "temp", "bonds-global-web", ".git"}

def should_exclude(path):
    return any(x in str(path).lower() for x in EXCLUDE)

def contains_keyword(name):
    lower = name.lower()
    return any(kw in lower for kw in KEYWORDS)

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
    print("  WIPO / UN Rights Organization File Collector")
    print("=" * 60)
    print(f"  Target: {TARGET}")
    print()

    TARGET.mkdir(parents=True, exist_ok=True)

    search_roots = [
        HOME / "Desktop",
        HOME / "Documents",
        HOME / "Downloads",
        HOME / "Pictures",
        HOME / "OneDrive" / "Desktop",
        HOME / "OneDrive" / "Documents",
        Path("C:/BondsCleanup"),
    ]

    found_files = []

    for root in search_roots:
        if not root.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if not should_exclude(Path(dirpath) / d)]
            current = Path(dirpath)
            if should_exclude(current):
                continue
            if current == TARGET or TARGET in current.parents:
                continue

            for filename in filenames:
                if should_exclude(filename):
                    continue
                if contains_keyword(filename):
                    file_path = current / filename
                    found_files.append(file_path)

    print(f"  Files found: {len(found_files)}")

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

    print("\n" + "=" * 60)
    print("  Done!")
    print("=" * 60)
    print(f"  Files copied: {copied}")
    print(f"  Failed: {failed}")
    print(f"  Total size: {total_size / (1024**2):.2f} MB")
    print(f"  Target: {TARGET}")
    print("=" * 60)

    log = HOME / f"Desktop/WIPO_Collection_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log, "w", encoding="utf-8") as f:
        f.write("WIPO / UN Rights Collection Log\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now()}\n\n")
        f.write(f"Files found: {len(found_files)}\n")
        f.write(f"Copied: {copied}\n")
        f.write(f"Failed: {failed}\n")
        f.write(f"Total size: {total_size / (1024**2):.2f} MB\n")
        f.write(f"\nTarget: {TARGET}\n")
        f.write("\nFiles:\n")
        for fp in found_files:
            f.write(f"  {fp}\n")
        f.write("=" * 50 + "\n")
    print(f"\nLog saved: {log}")

if __name__ == "__main__":
    main()
