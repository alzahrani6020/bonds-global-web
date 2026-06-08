import glob
import re

# Arabic HTML files (excluding en/ directories)
files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old = 'assets/bonds-logo-header.webp'
    new = 'assets/bonds-logo-v2.webp'
    
    # Handle different path depths
    if filepath.count('/') == 0:
        content = content.replace(old, new)
    elif filepath.count('/') == 1:
        content = content.replace(old, '../' + new)
    elif filepath.count('/') == 2:
        content = content.replace(old, '../../' + new)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {filepath}")

print("\nDone!")
