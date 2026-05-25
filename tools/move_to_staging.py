#!/usr/bin/env python3
"""
Bonds Staging Mover - Fast internal move (C: to C:)
Moves duplicates to C:\BondsCleanup\Duplicates\ (instant, same drive)
"""

import json
import shutil
from pathlib import Path
from datetime import datetime

STAGING = Path("C:/BondsCleanup/Duplicates")

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

def main():
    print("=" * 50)
    print("  Fast Staging Move (C: to C: - Instant)")
    print("=" * 50)
    
    with open("duplicates.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    dups = data["duplicates"]
    print(f"Total duplicates: {len(dups)}")
    
    moved = 0
    failed = 0
    skipped = 0
    moved_size = 0
    
    for i, dup in enumerate(dups):
        if (i + 1) % 500 == 0:
            print(f"  Progress: {i+1}/{len(dups)} | Moved: {moved}")
        
        src = Path(dup["duplicate"])
        if not src.exists():
            skipped += 1
            continue
        
        rel = src.relative_to(Path.home())
        dst = STAGING / rel
        
        if safe_move(src, dst):
            moved += 1
            moved_size += dup["size"]
        else:
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"  MOVED: {moved} files")
    print(f"  FAILED: {failed} files")
    print(f"  SKIPPED: {skipped} files")
    print(f"  Space freed on C: {moved_size / (1024**3):.2f} GB")
    print(f"  Location: {STAGING}")
    print("=" * 50)
    
    # Save log
    log = Path.home() / f"Desktop/BondsStaging_Log_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    with open(log, "w", encoding="utf-8") as f:
        f.write(f"Staging Move Log\nDate: {datetime.now()}\n")
        f.write(f"Moved: {moved}\nFailed: {failed}\nSize: {moved_size / (1024**3):.2f} GB\n")
    print(f"\nLog saved: {log}")

if __name__ == "__main__":
    main()
