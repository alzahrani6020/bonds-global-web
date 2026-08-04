#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Statically replace emoji characters in HTML text nodes with inline SVG spans.
Skips <script>, <style>, <title>, <textarea>, <noscript>, comments, and tags/attributes."""

import json, os, re
from pathlib import Path

PROTECTED_RE = re.compile(
    r'<(script|style|title|textarea|noscript)[^>]*>[\s\S]*?</\1>'
    r'|<!--[\s\S]*?-->'
    r'|<[^>]+>',
    re.IGNORECASE
)

EMOJI_RE = re.compile(
    '['
    '\U0001F300-\U0001F5FF'
    '\U0001F600-\U0001F64F'
    '\U0001F680-\U0001F6FF'
    '\U0001F700-\U0001F77F'
    '\U0001F780-\U0001F7FF'
    '\U0001F800-\U0001F8FF'
    '\U0001F900-\U0001F9FF'
    '\U0001FA00-\U0001FA6F'
    '\U0001FA70-\U0001FAFF'
    '\U00002600-\U000026FF'
    '\U00002700-\U000027BF'
    ']+',
    re.UNICODE
)


def build_mapping():
    with open('emoji-filename-map.json', 'r', encoding='utf-8') as f:
        filename_map = json.load(f)
    mapping = {}
    for emoji, filename in filename_map.items():
        path = Path('assets/emoji-svgs') / filename
        if not path.exists():
            continue
        svg = path.read_text(encoding='utf-8').strip()
        if 'aria-hidden' not in svg:
            svg = svg.replace('<svg', '<svg aria-hidden="true"', 1)
        mapping[emoji] = svg
    return mapping


def replace_text(text, mapping):
    if not EMOJI_RE.search(text):
        return text
    parts = []
    last = 0
    for m in EMOJI_RE.finditer(text):
        start, end = m.span()
        emoji = m.group(0)
        if emoji not in mapping:
            continue
        if start > last:
            parts.append(text[last:start])
        svg = mapping[emoji]
        parts.append(
            f'<span class="emoji-icon" style="display:inline-flex;width:1em;height:1em;vertical-align:-0.15em;" aria-hidden="true">{svg}</span>'
        )
        last = end
    if last < len(text):
        parts.append(text[last:])
    return ''.join(parts)


def replace_html(text, mapping):
    out = []
    pos = 0
    for m in PROTECTED_RE.finditer(text):
        # text before protected block
        if m.start() > pos:
            out.append(replace_text(text[pos:m.start()], mapping))
        # protected block as-is
        out.append(m.group(0))
        pos = m.end()
    if pos < len(text):
        out.append(replace_text(text[pos:], mapping))
    return ''.join(out)


def should_process(path):
    parts = path.parts
    if any(p in parts for p in ('node_modules', '.git', '.vercel', '.tmp-pdf', '__pycache__')):
        return False
    if path.suffix not in ('.html',):
        return False
    return True


def main():
    mapping = build_mapping()
    print(f'Loaded {len(mapping)} emoji SVGs')
    count = 0
    for root, dirs, files in os.walk('.'):
        # prune ignored dirs
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '.vercel', '.tmp-pdf', '__pycache__')]
        for f in files:
            if not f.endswith('.html'):
                continue
            path = Path(root) / f
            text = path.read_text(encoding='utf-8')
            new_text = replace_html(text, mapping)
            if new_text != text:
                path.write_text(new_text, encoding='utf-8')
                count += 1
                print(f'Updated {path}')
    print(f'Total files updated: {count}')


if __name__ == '__main__':
    main()
