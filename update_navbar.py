import os
import re
import glob

# The new navbar nav HTML
NEW_NAV_HTML = '''      <nav class="main-nav" id="mainNav">
        <ul>
          <li><a href="{home}">الرئيسية</a></li>
          <li><a href="{about}">من نحن</a></li>
          <li class="dropdown">
            <span class="dropdown-toggle" style="position: relative; color: var(--text-secondary); font-weight: 600; font-size: var(--text-sm); padding: var(--space-2) 0;">
              الخدمات
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
            <div class="dropdown-menu">
              <a href="{services}#analysis">التحليل المالي</a>
              <a href="{services}#cashflow">إدارة التدفقات النقدية</a>
              <a href="{services}#feasibility">دراسات الجدوى</a>
              <a href="{services}#risk">تحليل المخاطر</a>
              <a href="{services}#research">الاستبيانات والبحوث</a>
            </div>
          </li>
          <li class="dropdown">
            <span class="dropdown-toggle" style="position: relative; color: var(--text-secondary); font-weight: 600; font-size: var(--text-sm); padding: var(--space-2) 0;">
              الحاسبات
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
            <div class="dropdown-menu">
              <a href="{calc_breakeven}">نقطة التعادل</a>
              <a href="{calc_cashflow}">تدفق النقد</a>
              <a href="{calc_pricing}">تسعير المنتج</a>
              <a href="{calc_loan}">القرض والتمويل</a>
              <a href="{calc_restaurant}">المطاعم والسحابي</a>
              <a href="{calc_menu}">هندسة المنيو</a>
              <a href="{calc_feasibility}">جدوى المطعم</a>
              <a href="{calc_invoice}">تحليل الفواتير</a>
              <a href="{calc_template}">نموذج دراسة الجدوى</a>
            </div>
          </li>
          <li><a href="{pricing}">الأسعار</a></li>
          <li><a href="{blog}">مقالات</a></li>
          <li><a href="{contact}">تواصل</a></li>
        </ul>
      </nav>'''

def get_paths(rel_depth):
    """Generate path prefixes based on file depth"""
    if rel_depth == 0:
        return {
            'home': 'index.html',
            'about': 'about.html',
            'services': 'services.html',
            'pricing': 'pricing.html',
            'blog': 'blog/index.html',
            'contact': 'contact.html',
            'calc_breakeven': 'calculator.html',
            'calc_cashflow': 'calculators/cash-flow.html',
            'calc_pricing': 'calculators/pricing.html',
            'calc_loan': 'calculators/loan.html',
            'calc_restaurant': 'calculators/restaurant.html',
            'calc_menu': 'calculators/menu-engineering.html',
            'calc_feasibility': 'calculators/feasibility.html',
            'calc_invoice': 'calculators/invoice-analyzer.html',
            'calc_template': 'calculators/feasibility-template.html',
        }
    elif rel_depth == 1:
        return {
            'home': '../index.html',
            'about': '../about.html',
            'services': '../services.html',
            'pricing': '../pricing.html',
            'blog': '../blog/index.html',
            'contact': '../contact.html',
            'calc_breakeven': '../calculator.html',
            'calc_cashflow': '../calculators/cash-flow.html',
            'calc_pricing': '../calculators/pricing.html',
            'calc_loan': '../calculators/loan.html',
            'calc_restaurant': '../calculators/restaurant.html',
            'calc_menu': '../calculators/menu-engineering.html',
            'calc_feasibility': '../calculators/feasibility.html',
            'calc_invoice': '../calculators/invoice-analyzer.html',
            'calc_template': '../calculators/feasibility-template.html',
        }
    elif rel_depth == 2:
        return {
            'home': '../../index.html',
            'about': '../../about.html',
            'services': '../../services.html',
            'pricing': '../../pricing.html',
            'blog': '../../blog/index.html',
            'contact': '../../contact.html',
            'calc_breakeven': '../../calculator.html',
            'calc_cashflow': '../../calculators/cash-flow.html',
            'calc_pricing': '../../calculators/pricing.html',
            'calc_loan': '../../calculators/loan.html',
            'calc_restaurant': '../../calculators/restaurant.html',
            'calc_menu': '../../calculators/menu-engineering.html',
            'calc_feasibility': '../../calculators/feasibility.html',
            'calc_invoice': '../../calculators/invoice-analyzer.html',
            'calc_template': '../../calculators/feasibility-template.html',
        }
    else:
        return {
            'home': '../../index.html',
            'about': '../../about.html',
            'services': '../../services.html',
            'pricing': '../../pricing.html',
            'blog': '../../blog/index.html',
            'contact': '../../contact.html',
            'calc_breakeven': '../../calculator.html',
            'calc_cashflow': '../../calculators/cash-flow.html',
            'calc_pricing': '../../calculators/pricing.html',
            'calc_loan': '../../calculators/loan.html',
            'calc_restaurant': '../../calculators/restaurant.html',
            'calc_menu': '../../calculators/menu-engineering.html',
            'calc_feasibility': '../../calculators/feasibility.html',
            'calc_invoice': '../../calculators/invoice-analyzer.html',
            'calc_template': '../../calculators/feasibility-template.html',
        }

def fix_nav_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if file has the main-nav structure
    if 'class="main-nav"' not in content:
        return False
    
    # Calculate relative depth
    rel_path = os.path.relpath(filepath, '.')
    parts = rel_path.split(os.sep)
    if parts[0] == 'en':
        return False  # Skip English files for now
    
    depth = len(parts) - 1
    paths = get_paths(depth)
    
    new_nav = NEW_NAV_HTML.format(**paths)
    
    # Pattern to match the entire nav block
    pattern = r'      <nav class="main-nav" id="mainNav">.*?</nav>'
    
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_nav, content, flags=re.DOTALL)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

# Process all HTML files
files = glob.glob('**/*.html', recursive=True)
files = [f for f in files if not f.startswith('en/') and not f.startswith('node_modules/') and not f.startswith('.git/') and not f.startswith('.vercel/')]

updated = []
for filepath in files:
    if fix_nav_in_file(filepath):
        updated.append(filepath)

print(f"Updated {len(updated)} files:")
for f in updated:
    print(f"  - {f}")
