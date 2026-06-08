import glob

files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if file has header-left div
    if 'header-left' not in content:
        continue
    
    # Add dashboard link before login link
    old_login = '        <a href="calculators/auth/index.html" class="header-login">تسجيل الدخول</a>'
    new_login = '        <a href="calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n        <a href="calculators/auth/index.html" class="header-login">تسجيل الدخول</a>'
    
    if old_login in content:
        content = content.replace(old_login, new_login)
    else:
        # Try different depths
        old_login2 = old_login.replace('calculators/auth/index.html', '../calculators/auth/index.html')
        new_login2 = '        <a href="../calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n        <a href="../calculators/auth/index.html" class="header-login">تسجيل الدخول</a>'
        if old_login2 in content:
            content = content.replace(old_login2, new_login2)
        else:
            old_login3 = old_login.replace('calculators/auth/index.html', '../../calculators/auth/index.html')
            new_login3 = '        <a href="../../calculators/dashboard.html" class="header-login" style="color:var(--gold);">لوحة التحكم</a>\n        <a href="../../calculators/auth/index.html" class="header-login">تسجيل الدخول</a>'
            if old_login3 in content:
                content = content.replace(old_login3, new_login3)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {filepath}")

print("\nDone!")
