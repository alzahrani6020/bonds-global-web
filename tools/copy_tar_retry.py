#!/usr/bin/env python3
"""Copy Duplicates.tar to D: with retry on disconnect"""

import shutil
import time
from pathlib import Path

src = Path("C:/BondsCleanup/Duplicates.tar")
dst = Path("D:/BondsCleanup/Duplicates.tar")

print("Copying Duplicates.tar (5.9 GB) to D:...")
print("This will retry automatically if D: disconnects.")
print("DO NOT CLOSE THIS WINDOW!\n")

attempt = 0
while attempt < 20:
    attempt += 1
    try:
        if not Path("D:/").exists():
            print(f"[{attempt}] D: not ready. Waiting 10s...")
            time.sleep(10)
            continue
        
        dst.parent.mkdir(parents=True, exist_ok=True)
        
        # If partial file exists, remove it
        if dst.exists() and dst.stat().st_size < src.stat().st_size:
            print(f"[{attempt}] Partial file found. Removing...")
            dst.unlink()
        
        print(f"[{attempt}] Starting copy...")
        shutil.copy2(str(src), str(dst))
        
        # Verify
        if dst.exists() and dst.stat().st_size == src.stat().st_size:
            print(f"\nSUCCESS! File copied.")
            print(f"Size: {dst.stat().st_size / (1024**3):.2f} GB")
            print(f"Location: {dst}")
            break
        else:
            print(f"[{attempt}] Size mismatch. Retrying...")
            if dst.exists():
                dst.unlink()
    except Exception as e:
        print(f"[{attempt}] Error: {e}")
        print(f"[{attempt}] Retrying in 10 seconds...")
        time.sleep(10)
else:
    print("\nFAILED after 20 attempts. Please copy manually.")

input("\nPress Enter to exit...")
