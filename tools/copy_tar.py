#!/usr/bin/env python3
"""Copy Duplicates.tar to D: with retry logic"""

import shutil
import time
from pathlib import Path

src = Path("C:/BondsCleanup/Duplicates.tar")
dst = Path("D:/BondsCleanup/Duplicates.tar")

print("Copying Duplicates.tar to D:...")
print("This is a 5.9 GB file. Please wait...")
print("DO NOT DISCONNECT THE USB DRIVE!")

dst.parent.mkdir(parents=True, exist_ok=True)

retries = 0
while retries < 10:
    try:
        shutil.copy2(str(src), str(dst))
        print(f"\nSUCCESS! File copied to {dst}")
        print(f"Size: {dst.stat().st_size / (1024**3):.2f} GB")
        break
    except Exception as e:
        retries += 1
        print(f"Error (retry {retries}/10): {e}")
        time.sleep(10)
else:
    print("\nFAILED after 10 retries!")

input("\nPress Enter to exit...")
