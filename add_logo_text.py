import glob
import re

# Arabic HTML files
files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match logo-slot in header with closing </a>
    # Looking for: <a href="..." class="logo-slot">\n        <img src="..." alt="بوندز" class="site-logo" ... />\n      </a>
    pattern = r'(<a href="[^"]*" class="logo-slot">)\s*(<img[^>]*class="site-logo"[^>]*>)\s*(</a>)'
    
    def replacer(m):
        return f'{m.group(1)}\n        {m.group(2)}\n        <span class="logo-text">Bonds</span>\n      {m.group(3)}'
    
    new_content = re.sub(pattern, replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

print("\nDone!")
