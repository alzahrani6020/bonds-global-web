#!/usr/bin/env python3
"""
Add unified site-header/footer placeholders to calculator HTML files that received
the shared layout script/CSS but did not originally contain a <header> or <footer>.

Usage:
    python scripts/fix-calculators-layout.py [path ...]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BODY_START_RE = re.compile(r'(<body\b[^>]*>)', re.IGNORECASE)
BODY_END_RE = re.compile(r'(</body>)', re.IGNORECASE)


def relative_prefix(file_path: Path) -> str:
    depth = len(file_path.relative_to(ROOT).parent.parts)
    return "../" * depth if depth > 0 else ""


def process_file(file_path: Path, dry_run: bool = False) -> bool:
    html = file_path.read_text(encoding="utf-8")

    if 'id="site-header"' in html or 'id="site-footer"' in html:
        return False

    prefix = relative_prefix(file_path)
    changed = False

    # Add header placeholder right after <body>
    if 'id="site-header"' not in html:
        new_html, n = BODY_START_RE.subn(
            r'\1\n  <div id="site-header"></div>', html, count=1
        )
        if n:
            html = new_html
            changed = True

    # Add footer placeholder right before </body>
    if 'id="site-footer"' not in html:
        new_html, n = BODY_END_RE.subn(
            r'  <div id="site-footer"></div>\n\1', html, count=1
        )
        if n:
            html = new_html
            changed = True

    script_tag = f'<script src="{prefix}site-layout.js"></script>'
    if script_tag not in html and 'site-layout.js' not in html:
        body_end = re.compile(r'(</body>)', re.IGNORECASE)
        html, n = body_end.subn(f'{script_tag}\n\1', html, count=1)
        if n:
            changed = True

    if not changed:
        return False

    if dry_run:
        print(f"[dry-run] Would update: {file_path.relative_to(ROOT)}")
        return True

    file_path.write_text(html, encoding="utf-8")
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

    print(f"\nDone. Updated: {updated}, Skipped: {skipped}")


if __name__ == "__main__":
    main()
