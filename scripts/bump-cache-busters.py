import os
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent

PATTERNS = [
    # (regex pattern to find src without existing query string, replacement template)
    (
        re.compile(r'(src=["\'])(/bonds-auth-2026\.js)(["\'])'),
        r'\1/bonds-auth-2026.js?v=2\3',
    ),
    (
        re.compile(r'(src=["\'])(/supabase-client\.js\?v=5)(["\'])'),
        r'\1/supabase-client.js?v=6\3',
    ),
    (
        re.compile(r'(src=["\'])(\.\./admin/analytics-tracker\.js)(["\'])'),
        r'\1../admin/analytics-tracker.js?v=1\3',
    ),
    (
        re.compile(r'(src=["\'])(\.\./\.\./admin/analytics-tracker\.js)(["\'])'),
        r'\1../../admin/analytics-tracker.js?v=1\3',
    ),
]

HTML_GLOBS = [
    '**/*.html',
]

changed_files = []

for glob in HTML_GLOBS:
    for path in ROOT.glob(glob):
        if 'node_modules' in str(path) or '.next' in str(path) or '.vercel' in str(path):
            continue
        text = path.read_text(encoding='utf-8')
        new_text = text
        for pattern, repl in PATTERNS:
            new_text = pattern.sub(repl, new_text)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
            changed_files.append(str(path.relative_to(ROOT)))

print(f'Updated {len(changed_files)} files:')
for f in changed_files:
    print('  ', f)
