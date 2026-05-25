# -*- coding: utf-8 -*-
"""Compress site-logo.jpg: smaller file size, same pixel size (no stretch/crop)."""
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from PIL import Image
except ImportError:
    raise SystemExit("pip install pillow")


def main() -> None:
    root = Path(__file__).resolve().parent
    path = root / "assets" / "site-logo.jpg"
    if not path.is_file():
        print("Missing:", path)
        print("Add site-logo.jpg to assets/, then run: python compress_site_logo.py")
        return

    before = path.stat().st_size
    img = Image.open(path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    tmp = path.with_suffix(".tmp.jpg")
    img.save(tmp, "JPEG", quality=85, optimize=True, progressive=True)
    after = tmp.stat().st_size

    if after < before or after <= before * 1.02:
        tmp.replace(path)
        print("Compressed:", path)
        print(f"  {before:,} bytes -> {path.stat().st_size:,} bytes")
    else:
        tmp.unlink(missing_ok=True)
        print("Already compact; left unchanged.")


if __name__ == "__main__":
    main()
