#!/usr/bin/env python3
"""
Add width/height attributes to <img> tags that lack them, using Pillow for local images.
Skips external URLs, data URIs, SVGs, and images that cannot be read.
"""
import os
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED_DIRS = {"node_modules", ".git", ".vercel", ".archive", "tests"}


def walk_html(root):
    for entry in os.scandir(root):
        if entry.is_dir(follow_symlinks=False):
            if entry.name in EXCLUDED_DIRS:
                continue
            yield from walk_html(entry.path)
        elif entry.is_file() and entry.name.endswith(".html"):
            yield Path(entry.path)


def resolve_src(html_path: Path, src: str):
    if not src or src.startswith(("http://", "https://", "data:", "//", "#")):
        return None
    if src.startswith("/"):
        return ROOT / src.lstrip("/")
    return (html_path.parent / src).resolve()


IMG_RE = re.compile(r"<img\b([^>]+)>", re.IGNORECASE)
SRC_RE = re.compile(r'\bsrc=["\']([^"\']+)["\']', re.IGNORECASE)

updated_files = 0
updated_tags = 0
failed = []

for html_path in walk_html(ROOT):
    text = html_path.read_text(encoding="utf-8", errors="ignore")
    original = text

    def replace_img(match):
        global updated_tags
        attrs = match.group(1)
        if re.search(r'\bwidth\s*=', attrs, re.IGNORECASE) and re.search(r'\bheight\s*=', attrs, re.IGNORECASE):
            return match.group(0)
        src_match = SRC_RE.search(attrs)
        if not src_match:
            return match.group(0)
        img_path = resolve_src(html_path, src_match.group(1))
        if not img_path or not img_path.exists():
            return match.group(0)
        if img_path.suffix.lower() == ".svg":
            return match.group(0)
        try:
            with Image.open(img_path) as im:
                w, h = im.size
        except Exception as e:
            failed.append((str(img_path.relative_to(ROOT)), str(e)))
            return match.group(0)

        # Insert width/height after src (or at start if no src)
        new_attrs = attrs
        if not re.search(r'\bwidth\s*=', attrs, re.IGNORECASE):
            new_attrs += f' width="{w}"'
        if not re.search(r'\bheight\s*=', attrs, re.IGNORECASE):
            new_attrs += f' height="{h}"'
        return f"<img{new_attrs}>"

    new_text, count = IMG_RE.subn(replace_img, text)
    if new_text != original:
        html_path.write_text(new_text, encoding="utf-8")
        print("OK", html_path.relative_to(ROOT), f"({count})")
        updated_files += 1
        updated_tags += count

print(f"\nUpdated {updated_tags} img tags in {updated_files} files.")
if failed:
    print("Failed to read:", failed[:10])
