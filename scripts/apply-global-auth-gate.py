#!/usr/bin/env python3
"""
Apply the global auth gate to all HTML pages that do not already load
site-layout.js, auth-gate.js, or global-auth-gate.js.

Public auth/login pages are skipped.
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PUBLIC_PATH_PATTERNS = [
    r'^/calculators/auth/',
    r'^/en/calculators/auth/',
    r'^/client/login\.html',
    r'^/en/client/login\.html',
    r'^/pro/login\.html',
    r'^/auth\.html',
    r'^/auth-v2\.html',
    r'^/verify\.html',
    r'^/en/auth\.html',
    r'^/en/auth-v2\.html',
    r'^/en/verify\.html',
]

SKIP_FILES = [
    # Intentionally empty: user requested the entire site gated before login.
]

SKIP_DIRS = [
    '.git',
    'node_modules',
    '.vercel',
    '.tmp-geo',
    '.tmp-pdf',
    'tests',
    'templates',
]


def is_public_path(rel_path: str) -> bool:
    # Normalize to URL path
    url_path = '/' + rel_path.replace('\\', '/').replace('/index.html', '/')
    for pattern in PUBLIC_PATH_PATTERNS:
        if re.search(pattern, url_path):
            return True
    return False


def needs_gate(content: str) -> bool:
    return not any(token in content for token in [
        'global-auth-gate.js',
        'site-layout.js',
        'auth-gate.js',
    ])


def insert_gate(content: str) -> str:
    # Try to insert right before </head>
    marker = '</head>'
    script = '  <script src="/global-auth-gate.js?v=1"></script>\n'
    if marker in content:
        return content.replace(marker, script + marker, 1)
    # Fallback: insert right after <html> opening
    match = re.search(r'(<html[^>]*>)', content, re.IGNORECASE)
    if match:
        return content[:match.end()] + '\n' + script + content[match.end():]
    return script + content


def main():
    affected = []
    skipped_public = []
    for root, dirs, files in os.walk(ROOT):
        # Prune skip dirs
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            if not fname.endswith('.html'):
                continue
            full_path = Path(root) / fname
            rel_path = full_path.relative_to(ROOT).as_posix()
            if is_public_path(rel_path):
                skipped_public.append(rel_path)
                continue
            try:
                content = full_path.read_text(encoding='utf-8')
            except Exception as e:
                print(f'Warning: could not read {rel_path}: {e}')
                continue
            if needs_gate(content):
                new_content = insert_gate(content)
                full_path.write_text(new_content, encoding='utf-8')
                affected.append(rel_path)

    print(f'Applied global-auth-gate.js to {len(affected)} files.')
    print(f'Skipped {len(skipped_public)} public auth pages.')
    if affected:
        print('Sample affected files:')
        for p in affected[:10]:
            print('  ', p)


if __name__ == '__main__':
    main()
