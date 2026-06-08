
import os
import re

# Configuration
OLD_LOGO_PATTERNS = [
    r'site-logo\.webp',
    r'site-logo\.png', 
    r'site-logo\.jpg',
    r'bonds-logo\.webp',
    r'bonds-logo\.png',
    r'bonds-logo\.jpg',
    r'bonds-logo\.svg',
    r'bonds-logo-opt\.jpg',
]

NEW_LOGO = 'site-logo-new.webp'

# Files to update (from grep results)
files_to_update = [
    # Root HTML files
    'index.html', 'about.html', 'contact.html', 'faq.html', 'pricing.html',
    'services.html', 'methodology.html', 'privacy.html', 'calculator.html',
    # Calculators
    'calculators/feasibility-template.html',
    'calculators/feasibility-template-backup.html',
    'calculators/feasibility-template-real-estate.html',
    'calculators/pricing.html', 'calculators/dish-margin.html',
    'calculators/loan.html', 'calculators/restaurant.html',
    'calculators/cash-flow.html', 'calculators/feasibility.html',
    'calculators/en/pricing.html', 'calculators/en/loan.html',
    'calculators/en/cash-flow.html',
    # English
    'en/index.html', 'en/about.html', 'en/contact.html', 'en/faq.html',
    'en/pricing.html', 'en/services.html', 'en/calculator.html',
    'en/privacy.html', 'en/methodology.html',
    'en/calculators/feasibility-template.html',
    'en/calculators/feasibility-template-real-estate.html',
    'en/calculators/pricing.html', 'en/calculators/dish-margin.html',
    'en/calculators/loan.html', 'en/calculators/restaurant.html',
    'en/calculators/cash-flow.html', 'en/calculators/feasibility.html',
    # Blog
    'blog/index.html', 'blog/tax-zakat-sme.html', 'blog/pricing-strategy.html',
    'blog/financial-kpis.html', 'blog/cash-flow-mistakes.html',
    'blog/break-even-explained.html',
    'blog/en/index.html', 'blog/en/tax-zakat-sme.html',
    'blog/en/pricing-strategy.html', 'blog/en/financial-kpis.html',
    'blog/en/cash-flow-mistakes.html', 'blog/en/break-even-explained.html',
    # Sectors
    'sectors/manufacturing.html', 'sectors/en/manufacturing.html',
    # Other
    'sw.js', 'manifest.json',
]

updated_count = 0
for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern in OLD_LOGO_PATTERNS:
        content = re.sub(pattern, NEW_LOGO, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        updated_count += 1
        print(f"Updated: {filepath}")

print(f"
Total files updated: {updated_count}")
