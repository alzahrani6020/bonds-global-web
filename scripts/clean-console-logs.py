import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TARGET_DIRS = [
    BASE_DIR / 'calculators',
    BASE_DIR / 'en' / 'calculators',
    BASE_DIR / 'sectors',
    BASE_DIR / 'en' / 'sectors',
]

def clean_file(f):
    html = f.read_text(encoding='utf-8', errors='ignore')
    original = html
    # Remove console.log / console.warn / console.error statements (single-line)
    # This regex matches: console.xxx( ... ); possibly with trailing semicolon
    html = re.sub(r'\bconsole\.(log|warn|error)\s*\([^;]*?\)\s*;?', '', html, flags=re.DOTALL)
    # Remove multi-line console calls more aggressively
    # Find console.xxx( and remove until matching closing )
    while True:
        match = re.search(r'\bconsole\.(log|warn|error)\s*\(', html)
        if not match:
            break
        start = match.start()
        depth = 0
        end = match.end()
        in_string = False
        string_char = None
        while end < len(html):
            ch = html[end]
            if not in_string:
                if ch in ('"', "'", '`'):
                    in_string = True
                    string_char = ch
                elif ch == '(':
                    depth += 1
                elif ch == ')':
                    if depth == 0:
                        end += 1
                        break
                    depth -= 1
            else:
                if ch == string_char and html[end-1] != '\\':
                    in_string = False
            end += 1
        # Also consume trailing semicolon and whitespace
        while end < len(html) and html[end] in ' \t;':
            end += 1
        html = html[:start] + html[end:]

    if html != original:
        f.write_text(html, encoding='utf-8')
        return True
    return False

def main():
    files = []
    for d in TARGET_DIRS:
        if d.exists():
            files.extend(d.glob('*.html'))

    cleaned = 0
    for f in sorted(files):
        if clean_file(f):
            cleaned += 1
            print(f"Cleaned: {f.relative_to(BASE_DIR)}")

    print(f"\nTotal files cleaned: {cleaned}")

if __name__ == '__main__':
    main()
