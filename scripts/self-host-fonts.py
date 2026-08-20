#!/usr/bin/env python3
"""
Self-host Google Fonts used by styles/fonts-ar.css and styles/fonts-en.css.
Downloads WOFF2 font files and rewrites @font-face rules to use local paths.
"""
import hashlib
import os
import re
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "assets" / "fonts"
FONTS_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

FONT_SPECS = {
    "ar": "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
    "en": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
}


def font_filename(url: str) -> str:
    """Create a stable filename from the gstatic URL."""
    # Use the last path segment plus a hash
    base = Path(url).name.split("?")[0]
    h = hashlib.sha256(url.encode()).hexdigest()[:8]
    return f"{h}-{base}"


def download_font(url: str) -> Path:
    name = font_filename(url)
    dest = FONTS_DIR / name
    if dest.exists():
        return dest
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"  DOWNLOAD {name} ({len(resp.content)/1024:.1f} KB)")
    return dest


def self_host(lang: str, css_url: str):
    print(f"\nSelf-hosting fonts for '{lang}'...")
    resp = requests.get(css_url, headers={"User-Agent": UA}, timeout=60)
    resp.raise_for_status()
    css = resp.text

    urls = set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css))
    for url in urls:
        dest = download_font(url)
        css = css.replace(url, f"/assets/fonts/{dest.name}")

    out_path = ROOT / "styles" / f"fonts-{lang}.css"
    out_path.write_text(css, encoding="utf-8")
    print(f"  WRITTEN {out_path.relative_to(ROOT)} ({len(css)/1024:.1f} KB)")


def main():
    for lang, url in FONT_SPECS.items():
        self_host(lang, url)
    print("\nDone. Google Fonts are now self-hosted under assets/fonts/")


if __name__ == "__main__":
    main()
