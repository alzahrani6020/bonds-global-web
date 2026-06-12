import os
import re
from urllib.parse import urlparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TARGET_DIRS = [
    BASE_DIR / 'calculators',
    BASE_DIR / 'en' / 'calculators',
    BASE_DIR / 'sectors',
    BASE_DIR / 'en' / 'sectors',
]

EXTERNAL_PREFIXES = ('http://', 'https://', '//', 'mailto:', 'tel:', '#', 'javascript:', 'data:')

def collect_html_files():
    files = []
    for d in TARGET_DIRS:
        if d.exists():
            files.extend(d.glob('*.html'))
    return sorted(files)

def check_internal_links(html, rel_path):
    issues = []
    links = re.findall(r'href=["\']([^"\']+)["\']', html)
    links += re.findall(r'src=["\']([^"\']+)["\']', html)
    base_dir = rel_path.parent
    for link in links:
        link = link.strip()
        if not link or link.startswith(EXTERNAL_PREFIXES):
            continue
        # Handle query strings and fragments
        link = link.split('?')[0].split('#')[0]
        if link.startswith('/'):
            target = BASE_DIR / link.lstrip('/')
        else:
            target = (base_dir / link).resolve()
        try:
            target.relative_to(BASE_DIR)
        except ValueError:
            issues.append(f"  {rel_path}: link escapes project: {link}")
            continue
        if not target.exists():
            issues.append(f"  {rel_path}: missing target: {link}")
    return issues

def check_console_logs(html, rel_path):
    issues = []
    if 'console.log(' in html or 'console.error(' in html or 'console.warn(' in html:
        # Count occurrences
        for match in re.finditer(r'console\.(log|error|warn)\s*\(', html):
            line = html[:match.start()].count('\n') + 1
            issues.append(f"  {rel_path}:{line} console.{match.group(1)}()")
    return issues

def check_required_scripts(html, rel_path):
    """Ensure calculators/auth pages load auth scripts; skip others."""
    issues = []
    # Only check pages that likely need auth (those with header-actions and not in auth/ admin/)
    if 'header-actions' in html and 'bonds-auth-2026.js' not in html:
        # Skip known exceptions
        if '/auth/' not in str(rel_path) and '/admin/' not in str(rel_path):
            issues.append(f"  {rel_path}: has header but missing bonds-auth-2026.js")
    return issues

def main():
    files = collect_html_files()
    print(f"Checking {len(files)} files...\n")

    link_issues = []
    log_issues = []
    script_issues = []

    for f in files:
        rel = f.relative_to(BASE_DIR)
        html = f.read_text(encoding='utf-8', errors='ignore')
        link_issues.extend(check_internal_links(html, rel))
        log_issues.extend(check_console_logs(html, rel))
        script_issues.extend(check_required_scripts(html, rel))

    print(f"Internal link issues: {len(link_issues)}")
    for i in link_issues[:50]:
        print(i)
    if len(link_issues) > 50:
        print(f"  ... and {len(link_issues) - 50} more")

    print(f"\nConsole log issues: {len(log_issues)}")
    for i in log_issues[:50]:
        print(i)
    if len(log_issues) > 50:
        print(f"  ... and {len(log_issues) - 50} more")

    print(f"\nAuth script issues: {len(script_issues)}")
    for i in script_issues[:50]:
        print(i)

if __name__ == '__main__':
    main()
