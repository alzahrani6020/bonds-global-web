import glob
import re

# Arabic HTML files
files = glob.glob('*.html') + glob.glob('blog/*.html') + glob.glob('calculators/*.html') + glob.glob('calculators/auth/*.html') + glob.glob('sectors/*.html')
files = [f for f in files if '/en/' not in f and not f.startswith('en/')]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add datetime script before </body> if not exists
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
    
    # Add datetime span in header-actions
    if 'header-datetime' not in content:
        # Find header-actions div and add datetime span after lang-switch
        pattern = r'(<a href="[^"]*" class="lang-switch"[^>]*>EN</a>)'
        replacement = r'\1\n        <span id="header-datetime" class="header-datetime" style="color:var(--text-secondary);font-size:0.75rem;font-weight:500;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:6px;white-space:nowrap;"></span>'
        content = re.sub(pattern, replacement, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated: {filepath}")

print("\nDone!")
