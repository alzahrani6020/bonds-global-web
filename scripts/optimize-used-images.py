#!/usr/bin/env python3
"""
Convert large used PNG/JPEG images to WebP (downscaled to max 1200px)
and update references in HTML/CSS/JS/JSON.
Compress large PNG assets in-place.
"""
import os
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED_DIRS = {"node_modules", ".git", ".vercel", ".archive", "tests", ".tmp-pdf"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"}
REF_EXTS = {".html", ".css", ".js", ".json"}
SIZE_THRESHOLD = 300_000
MAX_WIDTH = 1200


def walk_files(root, exts, exclude_dirs):
    for entry in os.scandir(root):
        if entry.is_dir(follow_symlinks=False):
            if entry.name in exclude_dirs:
                continue
            yield from walk_files(entry.path, exts, exclude_dirs)
        elif entry.is_file() and Path(entry.name).suffix.lower() in exts:
            yield Path(entry.path)


def find_references(images):
    refs = {img: set() for img in images}
    for file in walk_files(ROOT, REF_EXTS, EXCLUDED_DIRS):
        try:
            text = file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for img in images:
            if img.name in text:
                refs[img].add(file)
    return refs


def convert_to_webp(src: Path):
    new_name = src.with_suffix(".webp").name
    dest = src.with_suffix(".webp")
    with Image.open(src) as im:
        # Convert palette/transparent images to RGBA if needed
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")
        w, h = im.size
        if w > MAX_WIDTH:
            ratio = MAX_WIDTH / w
            im = im.resize((MAX_WIDTH, int(h * ratio)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=85, method=6)
    return dest


def update_references(old_name: str, new_name: str):
    for file in walk_files(ROOT, REF_EXTS, EXCLUDED_DIRS):
        text = file.read_text(encoding="utf-8", errors="ignore")
        if old_name not in text:
            continue
        # Replace exact filename references
        new_text = re.sub(re.escape(old_name), new_name, text)
        if new_text != text:
            file.write_text(new_text, encoding="utf-8")


def compress_png_inplace(src: Path):
    with Image.open(src) as im:
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
        # Save with optimization
        im.save(src, "PNG", optimize=True)


def main():
    images = list(walk_files(ROOT, IMAGE_EXTS, EXCLUDED_DIRS))
    refs = find_references(images)

    converted = []
    compressed = []

    for img in sorted(images, key=lambda p: p.stat().st_size, reverse=True):
        size = img.stat().st_size
        if size < SIZE_THRESHOLD:
            continue
        if not refs.get(img):
            continue

        ext = img.suffix.lower()
        if ext in (".png", ".jpg", ".jpeg"):
            print(f"Converting {img.relative_to(ROOT)} ({size/1024:.1f} KB) -> WebP")
            new_path = convert_to_webp(img)
            update_references(img.name, new_path.name)
            os.remove(img)
            converted.append((img, new_path))
        elif ext == ".webp":
            # Already webp; skip unless oversized (rare)
            pass

    # Compress large used PNGs in place (e.g., og:image)
    for img in walk_files(ROOT, IMAGE_EXTS, EXCLUDED_DIRS):
        if not img.exists():
            continue
        size = img.stat().st_size
        if size < SIZE_THRESHOLD:
            continue
        if not refs.get(img):
            continue
        if img.suffix.lower() == ".png":
            old_size = size
            print(f"Compressing {img.relative_to(ROOT)} ({old_size/1024:.1f} KB)")
            compress_png_inplace(img)
            new_size = img.stat().st_size
            compressed.append((img, old_size, new_size))

    print(f"\nConverted {len(converted)} images to WebP.")
    if compressed:
        saved = sum(o - n for _, o, n in compressed)
        print(f"Compressed {len(compressed)} PNGs, saved {saved/1024:.1f} KB")


if __name__ == "__main__":
    main()
