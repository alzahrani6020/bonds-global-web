import os
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent

OLD_VERSION = '3.1.2'
NEW_VERSION = '3.1.3'

# Match bonds-auth-2026.js?v=OLD_VERSION with any path prefix
BUMP_RE = re.compile(r'(bonds-auth-2026\.js\?v=)' + re.escape(OLD_VERSION))
REPLACEMENT = r'\g<1>' + NEW_VERSION

EXCLUDED_DIR_PARTS = {
    'node_modules',
    '.git',
    '.vercel',
    '.next',
    '.archive',
    'templates',
    'test-results',
    'playwright-report',
    'coverage',
    '.cache',
    '__pycache__',
}

EXCLUDED_FILE_PARTS = {
    'node_modules',
    '.git',
    '.vercel',
    '.next',
    '.archive',
    'templates',
    '/tests/',
    'test-results',
    'playwright-report',
    'coverage',
    '.cache',
    '__pycache__',
    'supabase/.temp',
}

EXTENSIONS = {'.html', '.js'}


def is_allowed(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    lower = rel.lower()
    if path.suffix.lower() not in EXTENSIONS:
        return False
    for part in EXCLUDED_FILE_PARTS:
        if part in lower:
            return False
    for part in path.parts:
        if part in EXCLUDED_DIR_PARTS:
            return False
    return True


changed_files = []
examined = 0

for path in ROOT.rglob('*'):
    if not path.is_file():
        continue
    if not is_allowed(path):
        continue
    examined += 1
    text = path.read_text(encoding='utf-8')
    new_text = BUMP_RE.sub(REPLACEMENT, text)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        changed_files.append(str(path.relative_to(ROOT)))

print(f'Examined {examined} files')
print(f'Updated {len(changed_files)} files:')
for f in changed_files:
    print('  ', f)
