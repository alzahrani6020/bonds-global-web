#!/usr/bin/env python3
"""
Compress C:\BondsCleanup\Duplicates\ into a single ZIP file
Uses ZIP64 for large files (>4GB)
"""

import os
import zipfile
from pathlib import Path
from datetime import datetime

SRC = Path("C:/BondsCleanup/Duplicates")
ZIP_PATH = Path("C:/BondsCleanup/Duplicates.zip")

def main():
    print("=" * 55)
    print("  Composing Duplicates into ZIP Archive")
    print("=" * 55)
    print(f"  Source: {SRC}")
    print(f"  Output: {ZIP_PATH}")
    print("  This may take 10-20 minutes...")
    print("  DO NOT CLOSE THIS WINDOW!")
    print()

    if not SRC.exists():
        print("ERROR: Source folder not found!")
        input("Press Enter to exit...")
        return

    total_files = 0
    for root, dirs, files in os.walk(SRC):
        total_files += len(files)

    print(f"  Total files to compress: {total_files}")
    print("  Compressing...")

    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
        processed = 0
        for root, dirs, files in os.walk(SRC):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(SRC)
                try:
                    zf.write(file_path, arcname)
                    processed += 1
                    if processed % 100 == 0:
                        print(f"  {processed}/{total_files} files...")
                except Exception as e:
                    print(f"  ERROR: {arcname} -> {e}")

    zip_size = ZIP_PATH.stat().st_size
    print(f"\n  Done! Compressed {processed} files.")
    print(f"  ZIP size: {zip_size / (1024**3):.2f} GB")
    print(f"  Location: {ZIP_PATH}")
    print("\n  Next step: Copy this ZIP file to D:\BondsCleanup\")
    print("=" * 55)
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
