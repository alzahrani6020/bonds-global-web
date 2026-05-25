#!/usr/bin/env python3
"""
Bonds Duplicate Mover - USB-safe batch transfer
Moves duplicates to D: in small batches, resumes if disconnected
"""

import json
import shutil
import time
import os
from pathlib import Path
from datetime import datetime

TARGET = Path("D:/BondsCleanup/Duplicates")
BATCH_SIZE = 100
PROGRESS_FILE = Path("move_progress.json")

def format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(size_bytes) < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def verify_d_drive(max_retries=10):
    """Wait for D: to be available."""
    for i in range(max_retries):
        if Path("D:/").exists():
            return True
        print(f"   D: not ready, waiting... ({i+1}/{max_retries})")
        time.sleep(5)
    return False

def safe_move(src, dst):
    """Move file with collision handling."""
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
        print(f"      ERROR: {e}")
        return False

def main():
    print("=" * 55)
    print("  Bonds Duplicate Mover - USB-Safe Mode")
    print("=" * 55)
    print(f"  Target: {TARGET}")
    print(f"  Batch size: {BATCH_SIZE} files")
    print()

    # Load duplicates
    if not Path("duplicates.json").exists():
        print("ERROR: duplicates.json not found! Run scan first.")
        return

    with open("duplicates.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    all_dups = data["duplicates"]
    print(f"Total duplicates to move: {len(all_dups)}")

    # Check for previous progress
    start_index = 0
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            progress = json.load(f)
        start_index = progress.get("last_index", 0)
        print(f"Resuming from index {start_index} ({len(all_dups) - start_index} remaining)")

    moved = 0
    failed = 0
    skipped = 0
    moved_size = 0
    total_batches = (len(all_dups) - start_index + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_num, i in enumerate(range(start_index, len(all_dups), BATCH_SIZE)):
        batch = all_dups[i:i+BATCH_SIZE]
        print(f"\nBatch {batch_num + 1}/{total_batches} (files {i+1}-{min(i+BATCH_SIZE, len(all_dups))})")

        # Verify D: before each batch
        if not verify_d_drive():
            print("\nD: drive disconnected! Saving progress...")
            with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                json.dump({"last_index": i, "timestamp": datetime.now().isoformat()}, f)
            print(f"Progress saved. Reconnect D: and run again to resume.")
            print(f"Remaining: {len(all_dups) - i} files")
            return

        for dup in batch:
            src = Path(dup["duplicate"])
            if not src.exists():
                skipped += 1
                continue

            rel = src.relative_to(Path.home())
            dst = TARGET / rel

            if safe_move(src, dst):
                moved += 1
                moved_size += dup["size"]
            else:
                failed += 1

        # Save progress after each batch
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump({"last_index": i + len(batch), "timestamp": datetime.now().isoformat()}, f)

        print(f"   Moved: {moved} | Failed: {failed} | Skipped: {skipped}")
        print(f"   Space saved so far: {format_size(moved_size)}")

    # Done - remove progress file
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()

    print("\n" + "=" * 55)
    print("  DUPLICATE MOVE COMPLETE")
    print("=" * 55)
    print(f"  Total moved:   {moved} files")
    print(f"  Total failed:  {failed} files")
    print(f"  Total skipped: {skipped} files")
    print(f"  Space saved:   {format_size(moved_size)}")
    print(f"\n  Location: D:\\BondsCleanup\\Duplicates\\")
    print("=" * 55)

    # Save log
    log_path = Path.home() / f"Desktop/BondsMove_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("Bonds Duplicate Move Log\n")
        f.write("=" * 50 + "\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Moved: {moved} files\n")
        f.write(f"Failed: {failed} files\n")
        f.write(f"Skipped: {skipped} files\n")
        f.write(f"Space saved: {format_size(moved_size)}\n")
        f.write(f"Target: {TARGET}\n")
        f.write("=" * 50 + "\n")
    print(f"\nLog saved to: {log_path}")

if __name__ == "__main__":
    main()
