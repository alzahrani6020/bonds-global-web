import os
import re

# Arabic dropdown HTML
ar_dropdown = '''          <li class="dropdown">
            <span class="dropdown-toggle" style="position: relative; color: var(--text-secondary); font-weight: 600; font-size: var(--text-sm); padding: var(--space-2) 0;">
              الحاسبات
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
            <div class="dropdown-menu">
              <a href="calculator.html">نقطة التعادل</a>
              <a href="calculators/cash-flow.html">تدفق النقد</a>
              <a href="calculators/pricing.html">تسعير المنتج</a>
              <a href="calculators/loan.html">القرض والتمويل</a>
            </div>
          </li>'''

# English dropdown HTML
en_dropdown = '''          <li class="dropdown">
            <span class="dropdown-toggle" style="position: relative; color: var(--text-secondary); font-weight: 600; font-size: var(--text-sm); padding: var(--space-2) 0;">
              Calculators
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
            <div class="dropdown-menu">
              <a href="calculator.html">Break-Even</a>
              <a href="calculators/cash-flow.html">Cash Flow</a>
              <a href="calculators/pricing.html">Pricing</a>
              <a href="calculators/loan.html">Loan & Financing</a>
            </div>
          </li>'''

# Files to update
files = [
    'about.html', 'calculator.html', 'contact.html', 'faq.html', 'index.html',
    'pricing.html', 'privacy.html', 'services.html'
]
en_files = ['en/' + f for f in files]

for f in files:
    if not os.path.exists(f):
        continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    # Replace any calculator link line
    content = re.sub(r'\s*<li><a href="calculator\.html"[^>]*>آلة حاسبة</a></li>', '\n' + ar_dropdown, content)
    content = re.sub(r'\s*<li><a href="calculator\.html"[^>]*>آلة حاسبة</a></li>\n', '\n' + ar_dropdown + '\n', content)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f'Updated {f}')

for f in en_files:
    if not os.path.exists(f):
        continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    # Replace any calculator link line (might have class="active")
    content = re.sub(r'\s*<li><a href="calculator\.html"[^>]*>Calculator</a></li>', '\n' + en_dropdown, content)
    content = re.sub(r'\s*<li><a href="calculator\.html"[^>]*>Calculator</a></li>\n', '\n' + en_dropdown + '\n', content)
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f'Updated {f}')

# Update service worker
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()

old_assets = '''const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/services.html',
  '/pricing.html',
  '/about.html',
  '/calculator.html',
  '/contact.html',
  '/faq.html',
  '/privacy.html',
  '/styles.css',
  '/script.js',
  '/assets/site-logo.webp',
  '/assets/bonds-logo-opt.jpg'
];'''

new_assets = '''const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/services.html',
  '/pricing.html',
  '/about.html',
  '/calculator.html',
  '/contact.html',
  '/faq.html',
  '/privacy.html',
  '/styles.css',
  '/script.js',
  '/assets/site-logo.webp',
  '/assets/bonds-logo-opt.jpg',
  '/calculators/cash-flow.html',
  '/calculators/pricing.html',
  '/calculators/loan.html'
];'''

if old_assets in sw:
    sw = sw.replace(old_assets, new_assets)
    with open('sw.js', 'w', encoding='utf-8') as f:
        f.write(sw)
    print('Updated sw.js')
else:
    print('WARNING: Could not find exact STATIC_ASSETS block in sw.js')

print('Done!')
