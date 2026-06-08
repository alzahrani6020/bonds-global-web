import glob

files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove dashboard link from header (we'll add it conditionally via JS later)
    content = content.replace('        <a href="calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n', '')
    content = content.replace('        <a href="../calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n', '')
    content = content.replace('        <a href="../../calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n', '')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed: {filepath}")

print("\nDone! Dashboard link removed from header.")
