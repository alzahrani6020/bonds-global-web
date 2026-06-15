#!/usr/bin/env python3
"""
Integrate Bonds V3 into the main site under /v3/.
Run after `git mv bonds-v3 v3`.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V3 = ROOT / 'v3'

REPLACEMENTS = [
    # API base
    ("API_URL = '/api'", "API_URL = '/api/v3'"),
    ("const API_URL = '/api/ai/chat'", "const API_URL = '/api/v3/ai/chat'"),
    # Internal page links (prefix match to catch query strings)
    ('href="/city-intelligence', 'href="/v3/city-intelligence'),
    ('href="/city-comparison', 'href="/v3/city-comparison'),
    ('href="/project-readiness', 'href="/v3/project-readiness'),
    ('href="/opportunity-bank', 'href="/v3/opportunity-bank'),
    ('href="/investment-map', 'href="/v3/investment-map'),
    ('href="/scenarios', 'href="/v3/scenarios'),
    ('href="/admin', 'href="/v3/admin'),
    # Static assets
    ('src="/components/', 'src="/v3/components/'),
    # Misc API link
    ('href="/api/health"', 'href="/api/v3/health"'),
]


def process_file(path: Path):
    if path.suffix not in ('.html', '.js'):
        return False
    text = path.read_text(encoding='utf-8')
    new_text = text
    for old, new in REPLACEMENTS:
        new_text = new_text.replace(old, new)
    if new_text == text:
        return False
    path.write_text(new_text, encoding='utf-8')
    print(f'Updated: {path.relative_to(ROOT)}')
    return True


def main():
    updated = 0
    for f in V3.rglob('*'):
        if f.is_file() and process_file(f):
            updated += 1
    print(f'\nDone. Updated {updated} files.')


if __name__ == '__main__':
    main()
