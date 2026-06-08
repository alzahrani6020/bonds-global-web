import glob
import re

files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Remove logo-text (Bonds) from beside logo
    content = re.sub(r'\s*<span class="logo-text">Bonds</span>\s*', '\n      ', content)
    
    # 2. Replace company-name with datetime in header-actions
    old_name = '        <span class="company-name" style="color:var(--gold);font-weight:800;font-size:0.9rem;letter-spacing:1px;">Bonds</span>'
    new_datetime = '        <span id="header-datetime" style="color:var(--text-secondary);font-size:0.75rem;font-weight:500;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;white-space:nowrap;"></span>'
    
    if old_name in content:
        content = content.replace(old_name, new_datetime)
    else:
        # Try different depths
        old_name2 = old_name.replace('company-name', 'company-name')
        if old_name2 in content:
            content = content.replace(old_name2, new_datetime)
    
    # 3. Add datetime script if not exists
    if 'updateDateTime' not in content:
        script = '''<script>
function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('ar-SA', options);
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const el = document.getElementById('header-datetime');
  if (el) el.textContent = dateStr + ' | ' + timeStr;
}
setInterval(updateDateTime, 60000);
updateDateTime();
</script>'''
        content = content.replace('</body>', script + '\n</body>')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {filepath}")

print("\nDone!")
