#!/usr/bin/env python3
"""
Copy duplicates to D: in small batches (200 files per run)
Safe for unstable USB drives
"""

import os
import shutil
import json
from pathlib import Path

SRC = Path("C:/BondsCleanup/Duplicates")
DST = Path("D:/BondsCleanup/Duplicates")
BATCH_SIZE = 200
PROGRESS_FILE = Path("copy_progress.json")


def get_all_files(folder):
    files = []
    for root, dirs, filenames in os.walk(folder):
        for name in filenames:
            files.append(Path(root) / name)
    return sorted(files)


def relative_to(path, base):
    return path.relative_to(base)


def main():
    print("=" * 50)
    print("  Batch Copy to D: (200 files per run)")
    print("=" * 50)

    if not DST.exists():
        print("ERROR: D: not ready!")
        return

    # Get source files
    src_files = get_all_files(SRC)
    print(f"Source files: {len(src_files)}")

    # Get already copied files
    if DST.exists():
        dst_files = set(str(relative_to(f, DST)) for f in get_all_files(DST))
    else:
        dst_files = set()
    print(f"Already on D: {len(dst_files)}")

    # Find remaining
    remaining = []
    for f in src_files:
        rel = str(relative_to(f, SRC))
        if rel not in dst_files:
            remaining.append((f, rel))

    print(f"Remaining: {len(remaining)}")

    if not remaining:
        print("\nAll files copied! Done.")
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        return

    # Load progress
    start_idx = 0
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            progress = json.load(f)
        start_idx = progress.get("index", 0)
        if start_idx >= len(remaining):
            start_idx = 0

    batch = remaining[start_idx:start_idx + BATCH_SIZE]
    print(f"\nCopying batch {start_idx + 1}-{start_idx + len(batch)} of {len(remaining)}...")

    copied = 0
    failed = 0
    for src, rel in batch:
        dst_path = DST / rel
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(str(src), str(dst_path))
            copied += 1
        except Exception as e:
            print(f"  FAIL: {rel} -> {e}")
            failed += 1

    # Save progress
    next_idx = start_idx + len(batch)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump({"index": next_idx, "total": len(remaining)}, f)

    print(f"\nCopied: {copied} | Failed: {failed}")
    print(f"Progress: {next_idx}/{len(remaining)} files done")
    if next_idx >= len(remaining):
        print("\nALL DONE!")
        PROGRESS_FILE.unlink()


if __name__ == "__main__":
    main()
