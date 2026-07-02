import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (source html, design-system relative path, external css filename relative to html)
TARGETS = [
    ('calculators/restaurant.html', '../styles/design-system.css', 'restaurant.css'),
    ('calculators/cash-flow.html', '../styles/design-system.css', 'cash-flow.css'),
    ('calculators/pricing.html', '../styles/design-system.css', 'pricing.css'),
    ('calculators/loan.html', '../styles/design-system.css', 'loan.css'),
    ('calculators/creditworthiness.html', '../styles/design-system.css', 'creditworthiness.css'),
    ('calculators/medical-viability.html', '../styles/design-system.css', 'medical-viability.css'),
    ('calculators/feasibility.html', '../styles/design-system.css', 'feasibility.css'),
    ('calculators/dish-margin.html', '../styles/design-system.css', 'dish-margin.css'),
    ('calculators/menu-engineering.html', '../styles/design-system.css', 'menu-engineering.css'),
    ('en/calculators/restaurant.html', '../../styles/design-system.css', 'restaurant.css'),
    ('en/calculators/cash-flow.html', '../../styles/design-system.css', 'cash-flow.css'),
    ('en/calculators/pricing.html', '../../styles/design-system.css', 'pricing.css'),
    ('en/calculators/loan.html', '../../styles/design-system.css', 'loan.css'),
    ('en/calculators/creditworthiness.html', '../../styles/design-system.css', 'creditworthiness.css'),
    ('en/calculators/medical-viability.html', '../../styles/design-system.css', 'medical-viability.css'),
    ('en/calculators/feasibility.html', '../../styles/design-system.css', 'feasibility.css'),
    ('en/calculators/dish-margin.html', '../../styles/design-system.css', 'dish-margin.css'),
    ('en/calculators/menu-engineering.html', '../../styles/design-system.css', 'menu-engineering.css'),
]

def add_stylesheet(head, href, after_pattern):
    if href in head:
        return head
    m = re.search(after_pattern, head, re.IGNORECASE)
    if not m:
        # insert before </head>
        return re.sub(r'(</head>)', f'  <link rel="stylesheet" href="{href}" />\n\\1', head, count=1, flags=re.IGNORECASE)
    insert_pos = m.end()
    return head[:insert_pos] + f'\n  <link rel="stylesheet" href="{href}" />' + head[insert_pos:]

def link_tag_pattern(href):
    return r'<link[^>]*href="' + re.escape(href) + r'"[^>]*>'

for src_path, ds_href, css_name in TARGETS:
    src = ROOT / src_path
    if not src.exists():
        print('MISSING', src)
        continue
    html = src.read_text(encoding='utf-8')
    original = html

    # Extract all <style>...</style> blocks
    style_blocks = []
    def collect(match):
        style_blocks.append(match.group(1))
        return ''
    html_no_styles = re.sub(r'<style[^>]*>([\s\S]*?)</style>', collect, html, flags=re.IGNORECASE)

    # Split head/body roughly
    head_match = re.search(r'(<head[^>]*>)([\s\S]*?)(</head>)', html_no_styles, re.IGNORECASE)
    if not head_match:
        print('NO HEAD', src)
        continue
    head = head_match.group(2)
    before_head = html_no_styles[:head_match.start(2)]
    after_head = html_no_styles[head_match.end(2):]

    # Determine shared-calculators link pattern
    if 'en/calculators/' in src_path:
        shared_pattern = r'<link[^>]*href="\.\./\.\./calculators/shared-calculators\.css"[^>]*>'
    else:
        shared_pattern = r'<link[^>]*href="shared-calculators\.css"[^>]*>'

    # Add design-system after shared-calculators
    head = add_stylesheet(head, ds_href, shared_pattern)

    # Add external css link after design-system if there were styles
    css_content = '\n'.join(style_blocks).strip()
    if css_content:
        css_path = src.parent / css_name
        css_path.write_text(css_content + '\n', encoding='utf-8')
        # Add link to external css after design-system link tag
        head = add_stylesheet(head, css_name, link_tag_pattern(ds_href))
        print('WROTE CSS', css_path, 'bytes', len(css_content))

    # Reassemble
    new_html = before_head + head + after_head

    if new_html != original:
        src.write_text(new_html, encoding='utf-8')
        print('UPDATED', src)
    else:
        print('UNCHANGED', src)
