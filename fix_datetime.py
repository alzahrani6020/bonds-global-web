import glob
import re

files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already has datetime span
    if 'id="header-datetime"' in content:
        continue
    
    # Add span after lang-switch
    old = '        <a href="en/index.html" class="lang-switch" style="color:var(--text-secondary);font-weight:600;font-size:0.85rem;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;text-decoration:none;transition:all 0.3s;">EN</a>'
    new = old + '\n        <span id="header-datetime" style="color:var(--text-secondary);font-size:0.75rem;font-weight:500;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;white-space:nowrap;"></span>'
    
    if old in content:
        content = content.replace(old, new)
    else:
        # Try different path patterns
        old2 = old.replace('en/index.html', '../en/index.html')
        new2 = old2 + '\n        <span id="header-datetime" style="color:var(--text-secondary);font-size:0.75rem;font-weight:500;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;white-space:nowrap;"></span>'
        if old2 in content:
            content = content.replace(old2, new2)
        else:
            old3 = old.replace('en/index.html', '../../en/index.html')
            new3 = old3 + '\n        <span id="header-datetime" style="color:var(--text-secondary);font-size:0.75rem;font-weight:500;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;white-space:nowrap;"></span>'
            if old3 in content:
                content = content.replace(old3, new3)
    
    # Add script before </body> if not exists
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
