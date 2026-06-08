import glob
import re

files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove datetime span
    content = re.sub(r'\s*<span id="header-datetime"[^>]*></span>', '', content)
    
    # Remove datetime script
    content = re.sub(r'<script>\s*function updateDateTime\(\)[^<]*</script>\s*', '', content, flags=re.DOTALL)
    content = re.sub(r'<script>\s*function updateDateTime\(\)[^}]*}\s*</script>\s*', '', content, flags=re.DOTALL)
    
    # Remove any remaining updateDateTime scripts
    content = re.sub(r'<script>\s*function updateDateTime\(\)\s*{[^}]*}[^<]*</script>\s*', '', content, flags=re.DOTALL)
    content = re.sub(r'<script>\s*function updateDateTime\(\)\s*{.*?}\s*</script>\s*', '', content, flags=re.DOTALL)
    
    # Replace with company name span if not exists in header-actions
    if '<span class="company-name">Bonds</span>' not in content:
        old = '        <a href="en/index.html" class="lang-switch" style="color:var(--text-secondary);font-weight:600;font-size:0.85rem;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;text-decoration:none;transition:all 0.3s;">EN</a>'
        new = old + '\n        <span class="company-name" style="color:var(--gold);font-weight:800;font-size:0.9rem;letter-spacing:1px;">Bonds</span>'
        
        if old in content:
            content = content.replace(old, new)
        else:
            old2 = old.replace('en/index.html', '../en/index.html')
            new2 = old2 + '\n        <span class="company-name" style="color:var(--gold);font-weight:800;font-size:0.9rem;letter-spacing:1px;">Bonds</span>'
            if old2 in content:
                content = content.replace(old2, new2)
            else:
                old3 = old.replace('en/index.html', '../../en/index.html')
                new3 = old3 + '\n        <span class="company-name" style="color:var(--gold);font-weight:800;font-size:0.9rem;letter-spacing:1px;">Bonds</span>'
                if old3 in content:
                    content = content.replace(old3, new3)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {filepath}")

print("\nDone!")
