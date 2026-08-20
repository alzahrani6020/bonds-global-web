#!/usr/bin/env python3
"""
Comprehensive image optimization:
1. Archive all image files not referenced in HTML/CSS/JS/JSON.
2. Convert used PNG/JPEG images >100KB to WebP with downscaling.
   Only keeps the WebP if it is at least 15% smaller than the original.
3. Update references and remove originals only when conversion wins.
"""
import os
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / ".archive"
EXCLUDED_DIRS = {"node_modules", ".git", ".vercel", ".archive", "tests", ".tmp-pdf"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"}
REF_EXTS = {".html", ".css", ".js", ".json"}
SIZE_THRESHOLD = 100_000
MAX_WIDTH = 1200
MIN_SAVING_RATIO = 0.15


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


def try_convert_to_webp(src: Path):
    """Returns Path to webp if conversion is worthwhile, else None."""
    dest = src.with_suffix(".webp")
    with Image.open(src) as im:
        original_mode = im.mode
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")
        w, h = im.size
        if w > MAX_WIDTH:
            ratio = MAX_WIDTH / w
            im = im.resize((MAX_WIDTH, int(h * ratio)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=85, method=6)

    original_size = src.stat().st_size
    new_size = dest.stat().st_size
    saving = original_size - new_size

    if saving >= original_size * MIN_SAVING_RATIO:
        return dest
    else:
        # Not worth it; remove the candidate
        os.remove(dest)
        return None


def update_references(old_name: str, new_name: str):
    for file in walk_files(ROOT, REF_EXTS, EXCLUDED_DIRS):
        text = file.read_text(encoding="utf-8", errors="ignore")
        if old_name not in text:
            continue
        new_text = re.sub(re.escape(old_name), new_name, text)
        if new_text != text:
            file.write_text(new_text, encoding="utf-8")


def archive_image(src: Path):
    rel = src.relative_to(ROOT)
    dest = ARCHIVE / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    os.replace(src, dest)
    return dest


def main():
    images = list(walk_files(ROOT, IMAGE_EXTS, EXCLUDED_DIRS))
    refs = find_references(images)

    archived = 0
    archived_bytes = 0
    converted = 0
    converted_bytes = 0
    skipped = 0

    # Phase 1: Archive all unused images
    for img in images:
        if refs.get(img):
            continue
        size = img.stat().st_size
        archive_image(img)
        print(f"ARCHIVED {size/1024:.1f} KB {img.relative_to(ROOT)}")
        archived += 1
        archived_bytes += size

    # Re-scan after archiving
    images = list(walk_files(ROOT, IMAGE_EXTS, EXCLUDED_DIRS))
    refs = find_references(images)

    # Phase 2: Convert used PNG/JPEG > threshold to WebP if it saves space
    for img in images:
        size = img.stat().st_size
        if size < SIZE_THRESHOLD:
            continue
        if not refs.get(img):
            continue
        ext = img.suffix.lower()
        if ext not in (".png", ".jpg", ".jpeg"):
            continue

        print(f"TRY {img.relative_to(ROOT)} ({size/1024:.1f} KB) -> WebP")
        new_path = try_convert_to_webp(img)
        if new_path is None:
            print(f"  SKIP: conversion not beneficial")
            skipped += 1
            continue

        saved = size - new_path.stat().st_size
        update_references(img.name, new_path.name)
        os.remove(img)
        converted += 1
        converted_bytes += saved
        print(f"  OK: saved {saved/1024:.1f} KB")

    print(f"\nArchived {archived} files ({archived_bytes/1024/1024:.2f} MB)")
    print(f"Converted {converted} files, saved {converted_bytes/1024/1024:.2f} MB")
    print(f"Skipped {skipped} files (no benefit)")


if __name__ == "__main__":
    main()
