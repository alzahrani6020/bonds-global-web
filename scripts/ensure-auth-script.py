#!/usr/bin/env python3
"""
Ensure every HTML page that uses the unified site layout (or legacy auth
helpers) loads the unified auth system before it needs it.

Rules:
- Skip HTML files that already reference bonds-auth-2026.js.
- Skip build/dependency directories (.vercel/output, node_modules, .git, etc.).
- For remaining HTML files that reference site-layout.js, supabase-client.js
  or auth-guard.js, insert (if missing):
    <script src="/api/env"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="/bonds-auth-2026.js?v=3.0.8"></script>
  directly before the first matching script tag.
- The inserted scripts mirror the `defer` attribute of the matched tag so
  execution order stays predictable.
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SKIP_DIRS = {
    '.git', '.github', '.vercel', 'node_modules', '.tmp-pdf',
    '__pycache__', 'scripts', 'tools', 'tests'
}

AUTH_SRC = '/bonds-auth-2026.js?v=3.0.8'
ENV_SRC = '/api/env'
SUPABASE_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'

# Match a <script ... src="...site-layout.js|supabase-client.js|auth-guard.js..." ...>
SCRIPT_RE = re.compile(
    r'(?P<lead>[ \t]*)<script(?P<pre>\s+[^>]*)src="(?P<src>[^"]*(?:site-layout\.js|supabase-client\.js|auth-guard\.js)[^"]*)"(?P<post>[^>]*)>',
    re.IGNORECASE
)


def has_script(content, bare_src):
    # Look for the bare path ignoring query string
    pattern = re.escape(bare_src.split('?')[0])
    return bool(re.search(r'<script[^>]*src="[^"]*' + pattern, content, re.IGNORECASE))


def defer_in_tag(tag):
    return bool(re.search(r'\bdefer\b', tag, re.IGNORECASE))


def process_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Already has unified auth -> nothing to do
    if has_script(content, AUTH_SRC):
        return False

    m = SCRIPT_RE.search(content)
    if not m:
        return False

    lead = m.group('lead')
    pre = m.group('pre') or ''
    post = m.group('post') or ''
    tag_text = f'<script{pre}src="{m.group("src")}"{post}>'
    is_defer = defer_in_tag(tag_text)
    defer_attr = ' defer' if is_defer else ''

    additions = []
    if not has_script(content, ENV_SRC):
        additions.append(f'{lead}<script src="{ENV_SRC}"{defer_attr}></script>')
    if not has_script(content, SUPABASE_SRC):
        additions.append(f'{lead}<script src="{SUPABASE_SRC}"{defer_attr}></script>')
    additions.append(f'{lead}<script src="{AUTH_SRC}"{defer_attr}></script>')

    new_block = '\n'.join(additions) + '\n' + m.group(0)
    new_content = content[:m.start()] + new_block + content[m.end():]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True


def should_skip_dir(dirname):
    return dirname in SKIP_DIRS or dirname.startswith('.')


def main():
    changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Prune skipped directories
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for name in filenames:
            if not name.lower().endswith('.html'):
                continue
            path = os.path.join(dirpath, name)
            if process_file(path):
                rel = os.path.relpath(path, ROOT)
                print(f'[added auth] {rel}')
                changed += 1
    print(f'\nTotal files updated: {changed}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
