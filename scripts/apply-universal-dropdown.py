#!/usr/bin/env python3
"""
Apply UniversalDropdown enhancements to HTML files.

Usage:
  python scripts/apply-universal-dropdown.py path/to/file.html [...]
  python scripts/apply-universal-dropdown.py --glob "admin/*.html"
  python scripts/apply-universal-dropdown.py --glob "calculators/*.html" --search-threshold 8

What it does:
  - Adds data-universal-dropdown to <select> elements.
  - Adds data-ud-search when options > threshold.
  - Adds data-ud-sort for lists likely to benefit (country/city/industry selects).
  - Injects component CSS/JS relative to the file depth.
  - Avoids double-injection.
"""

import argparse
import glob
import os
import re
import sys
from pathlib import Path

CSS_LINK = '<link rel="stylesheet" href="{rel}components/universal-dropdown.css?v=2.51.8" />'
JS_SCRIPTS = """<script src="{rel}components/universal-dropdown.js?v=2.51.8"></script>
<script src="{rel}components/universal-dropdown-init.js"></script>"""

SORT_HINTS = {"country", "city", "governorate", "region", "industry", "sector", "activity", "advisor", "client", "project", "investor", "metric", "report", "asset", "distressed", "feasibility", "study"}

LIGHT_THEME_INDICATORS = ["#f5f0e8", "--bg: #ffffff", "--bg: #fff", "--bg-secondary: #ffffff", "--bg-secondary: #fff", "background: #ffffff", "background: #fff"]
DARK_THEME_INDICATORS = ["#0a0f1a", "#111827", "--bg: #0a0f1a"]


def rel_to_root(html_path: Path) -> str:
    """Return relative prefix from html file to project root."""
    script_dir = Path(__file__).resolve().parent
    root = script_dir.parent
    rel_dir = os.path.relpath(html_path.parent, root)
    if rel_dir == ".":
        return ""
    return "/".join([".."] * len(Path(rel_dir).parts)) + "/"


def already_enhanced(text: str) -> bool:
    # Consider enhanced only if both assets are present; attributes can be added safely without duplicates.
    return "universal-dropdown.js" in text and "universal-dropdown.css" in text


def inject_assets(text: str, rel: str) -> str:
    css = CSS_LINK.format(rel=rel)
    js = JS_SCRIPTS.format(rel=rel)

    # Inject CSS before </head>
    if "universal-dropdown.css" not in text:
        if "</head>" in text:
            text = text.replace("</head>", f"{css}\n</head>", 1)
        elif "<body" in text:
            text = text.replace("<body", f"{css}\n<body", 1)

    # Inject JS before </body>
    if "universal-dropdown.js" not in text:
        if "</body>" in text:
            text = text.replace("</body>", f"{js}\n</body>", 1)
        else:
            text = text + f"\n{js}\n"

    return text


def add_select_attrs(text: str, search_threshold: int) -> str:
    def select_repl(match: re.Match) -> str:
        tag = match.group(0)
        if "data-universal-dropdown" in tag:
            return tag
        # Multi-select is supported; keep the attribute so the component enhances it

        # Count option children roughly
        body = match.group(2) or ""
        option_count = body.lower().count("<option")

        attrs = ['data-universal-dropdown="true"']

        # Detect lists that are likely populated dynamically with reference data
        lowered = (tag + body).lower()
        is_reference = any(h in lowered for h in SORT_HINTS)
        is_long_list = option_count > search_threshold

        # Auto-enable search for long lists or known reference selectors
        if is_long_list or is_reference:
            attrs.append('data-ud-search="true"')

        # Sort/dedupe/clean reference lists (even if small now, they may grow)
        if is_reference:
            attrs.append('data-ud-sort="true"')
            attrs.append('data-ud-deduplicate="true"')
            attrs.append('data-ud-remove-empty="true"')

        # Insert attributes after <select
        attr_str = " " + " ".join(attrs)
        return tag.replace("<select", f"<select{attr_str}", 1)

    # Match select open tag and inner content (non-greedy)
    pattern = re.compile(r"(<select\b[^>]*>)(.*?)(</select>)", re.IGNORECASE | re.DOTALL)
    return pattern.sub(select_repl, text)


def looks_light_themed(text: str) -> bool:
    lowered = text.lower()
    if any(d in lowered for d in DARK_THEME_INDICATORS):
        return False
    return any(l in lowered for l in LIGHT_THEME_INDICATORS)


def apply_light_theme(text: str) -> str:
    if 'data-ud-theme' in text:
        return text
    if not looks_light_themed(text):
        return text
    if '<html lang="ar" dir="rtl">' in text:
        return text.replace('<html lang="ar" dir="rtl">', '<html lang="ar" dir="rtl" data-ud-theme="light">', 1)
    if '<html lang="en" dir="ltr">' in text:
        return text.replace('<html lang="en" dir="ltr">', '<html lang="en" dir="ltr" data-ud-theme="light">', 1)
    return text


def process_file(path: Path, search_threshold: int, dry_run: bool) -> bool:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else ("\n" if b"\n" in raw else None)
    text = raw.decode("utf-8")
    # Normalize line endings internally to plain \n so injected strings match.
    if newline:
        text = text.replace(newline, "\n")
    if already_enhanced(text):
        print(f"  skip (already enhanced): {path}")
        return False
    if not re.search(r"<select\b", text, re.IGNORECASE):
        print(f"  skip (no selects): {path}")
        return False

    rel = rel_to_root(path)
    text = inject_assets(text, rel)
    text = add_select_attrs(text, search_threshold)
    text = apply_light_theme(text)

    if dry_run:
        print(f"  would update: {path}")
        return True

    path.write_text(text, encoding="utf-8", newline=newline)
    print(f"  updated: {path}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Apply UniversalDropdown to HTML files")
    parser.add_argument("paths", nargs="*", help="HTML files to process")
    parser.add_argument("--glob", action="append", help="Glob pattern(s)")
    parser.add_argument("--search-threshold", type=int, default=10, help="Option count threshold for search")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = parser.parse_args()

    files = set()
    for p in args.paths:
        files.add(Path(p).resolve())
    for g in args.glob or []:
        for p in glob.glob(g, recursive=True):
            path = Path(p).resolve()
            parts = {part.lower() for part in path.parts}
            if parts & {"node_modules", ".git", ".vercel", ".next", "__pycache__"}:
                continue
            files.add(path)

    files = sorted(p for p in files if p.suffix.lower() == ".html" and p.exists())
    if not files:
        print("No HTML files found.")
        sys.exit(0)

    updated = 0
    for path in files:
        if process_file(path, args.search_threshold, args.dry_run):
            updated += 1

    print(f"\nDone. {updated} file(s) {'would be ' if args.dry_run else ''}updated out of {len(files)}.")


if __name__ == "__main__":
    main()
