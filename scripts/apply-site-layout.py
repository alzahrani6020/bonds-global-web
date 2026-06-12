#!/usr/bin/env python3
"""
Apply unified site header/footer layout to HTML files.

This script:
1. Replaces the existing <header class="main-header">...</header> with <div id="site-header"></div>.
2. Replaces the existing <footer class="footer">...</footer> with <div id="site-footer"></div>.
3. Adds <script src="{relative}site-layout.js"></script> before </body>.
4. Adds <link rel="stylesheet" href="{relative}header-footer.css"> in <head> if not present.

Usage:
    python scripts/apply-site-layout.py <file-or-directory> [file-or-directory ...]

Examples:
    python scripts/apply-site-layout.py index.html
    python scripts/apply-site-layout.py en/
    python scripts/apply-site-layout.py .
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Match common header variants: main-header, simple header, or navbar header (feasibility templates)
HEADER_RE = re.compile(
    r'<header\b[^>]*\bclass="[^"]*main-header[^"]*"[^>]*>.*?</header>',
    re.DOTALL | re.IGNORECASE,
)
SIMPLE_HEADER_RE = re.compile(
    r'<header\b[^>]*\bclass="[^"]*\bheader\b[^"]*"[^>]*>.*?</header>',
    re.DOTALL | re.IGNORECASE,
)
NAVBAR_RE = re.compile(
    r'<nav\b[^>]*\bclass="[^"]*navbar[^"]*"[^>]*>.*?</nav>',
    re.DOTALL | re.IGNORECASE,
)
FOOTER_RE = re.compile(
    r'<footer\b[^>]*>.*?</footer>',
    re.DOTALL | re.IGNORECASE,
)
BODY_END_RE = re.compile(r'</body>', re.IGNORECASE)
HEAD_END_RE = re.compile(r'</head>', re.IGNORECASE)


def relative_prefix(file_path: Path) -> str:
    """Return the prefix needed to reach the site root from this file."""
    depth = len(file_path.relative_to(ROOT).parent.parts)
    return "../" * depth if depth > 0 else ""


def has_site_layout(html: str) -> bool:
    return 'id="site-header"' in html and 'id="site-footer"' in html


def process_file(file_path: Path, dry_run: bool = False) -> bool:
    html = file_path.read_text(encoding="utf-8")

    if has_site_layout(html):
        return False  # already processed

    prefix = relative_prefix(file_path)

    # Replace existing header/footer with placeholders (try each header style once)
    new_html = HEADER_RE.sub('<div id="site-header"></div>', html, count=1)
    new_html = SIMPLE_HEADER_RE.sub('<div id="site-header"></div>', new_html, count=1)
    new_html = NAVBAR_RE.sub('<div id="site-header"></div>', new_html, count=1)
    new_html = FOOTER_RE.sub('<div id="site-footer"></div>', new_html, count=1)

    # Add site-layout.js before </body>
    script_tag = f'<script src="{prefix}site-layout.js"></script>'
    if script_tag not in new_html:
        new_html = BODY_END_RE.sub(f'{script_tag}\n</body>', new_html, count=1)

    # Add header-footer.css if not present
    css_href = f'{prefix}header-footer.css'
    css_tag = f'<link rel="stylesheet" href="{css_href}" />'
    if css_href not in new_html and 'header-footer.css' not in new_html:
        new_html = HEAD_END_RE.sub(f'{css_tag}\n</head>', new_html, count=1)

    if dry_run:
        print(f"[dry-run] Would update: {file_path.relative_to(ROOT)}")
        return True

    file_path.write_text(new_html, encoding="utf-8")
    print(f"Updated: {file_path.relative_to(ROOT)}")
    return True


def collect_files(paths):
    files = set()
    for p in paths:
        target = ROOT / p
        if target.is_file() and target.suffix == ".html":
            files.add(target)
        elif target.is_dir():
            files.update(target.rglob("*.html"))
    return sorted(files)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    dry_run = "--dry-run" in sys.argv
    paths = [p for p in sys.argv[1:] if p != "--dry-run"]

    files = collect_files(paths)
    updated = 0
    skipped = 0

    for f in files:
        try:
            if process_file(f, dry_run=dry_run):
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"ERROR processing {f.relative_to(ROOT)}: {e}", file=sys.stderr)

    print(f"\nDone. Updated: {updated}, Skipped (already layout): {skipped}")


if __name__ == "__main__":
    main()
