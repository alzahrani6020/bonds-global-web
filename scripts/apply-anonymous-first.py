#!/usr/bin/env python3
"""Apply anonymous-first UX / conversion enhancements to the listed calculators."""
import json, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = [
  'calculators/creditworthiness.html','calculators/dashboard.html','calculators/dish-margin.html',
  'calculators/invoice-analyzer.html','calculators/manufacturing-feasibility.html','calculators/medical-viability.html',
  'calculators/menu-engineering-simple.html','calculators/menu-engineering.html','calculators/real-project-analysis.html',
  'calculators/restaurant.html','calculators/feasibility-template.html','calculators/feasibility-template-real-estate.html',
  'en/calculators/creditworthiness.html','en/calculators/dashboard.html','en/calculators/dish-margin.html',
  'en/calculators/invoice-analyzer.html','en/calculators/manufacturing-feasibility.html','en/calculators/medical-viability.html',
  'en/calculators/menu-engineering-simple.html','en/calculators/menu-engineering.html','en/calculators/real-project-analysis.html',
  'en/calculators/restaurant.html','en/calculators/feasibility-template.html','en/calculators/feasibility-template-real-estate.html'
]

# Common base configs per calculator (Arabic). English mirrors will override lang/title.
BASE_CONFIGS = {
  'creditworthiness': {
    'name': 'creditworthiness',
    'v3': {'capital':'#financingAmount','revenue':'#revenue','profit':'#netProfit','sector':'#sector','activity':'#companyName'},
    'saveTitle': 'تحليل الائتمان'
  },
  'dashboard': {
    'name': 'dashboard',
    'skipV3Button': True,
    'skipDraftRestore': True
  },
  'dish-margin': {
    'name': 'dish-margin',
    'v3': {'capital':'#valTotalCost','revenue':'#sellingPrice','profit':'#valProfit','sector':'#dishName','activity':'#dishName'},
    'saveTitle': 'ربحية الوجبة'
  },
  'invoice-analyzer': {
    'name': 'invoice-analyzer',
    'v3': {'capital':'#productCost','revenue':'#sumYearly','profit':'#valNetProfit','sector':'#itemName','activity':'#itemName'},
    'saveTitle': 'تحليل الفاتورة'
  },
  'manufacturing-feasibility': {
    'name': 'manufacturing-feasibility',
    'v3': {'capital':'#setupTotal','revenue':'#revYearly','cost':'#monthlyTotal'},
    'saveTitle': 'دراسة الجدوى التصنيعية'
  },
  'medical-viability': {
    'name': 'medical-viability',
    'v3': {'sector':'#activity','activity':'#activity'},
    'saveTitle': 'الجدوى الطبية'
  },
  'menu-engineering-simple': {
    'name': 'menu-engineering-simple',
    'skipV3Button': True,
    'skipDraftRestore': True
  },
  'menu-engineering': {
    'name': 'menu-engineering',
    'v3': {},
    'saveTitle': 'هندسة المنيو'
  },
  'real-project-analysis': {
    'name': 'real-project-analysis',
    'v3': {'capital':'#projectValue','revenue':'#revenue','cost':'#costs','sector':'#activityType','activity':'#project'},
    'saveTitle': 'تحليل المشروع الحقيقي'
  },
  'restaurant': {
    'name': 'restaurant',
    'v3': {'capital':'#rentCost','revenue':'#monthlyGMV','profit':'#targetProfitPerOrder','sector':'#countrySelect','activity':'#countrySelect'},
    'saveTitle': 'حاسبة المطاعم'
  },
  'feasibility-template': {
    'name': 'feasibility-template',
    'v3': {'capital':'#total-capital','revenue':'#total-revenue','profit':'#net-profit','sector':'#cover-business-name','activity':'#cover-idea'},
    'saveTitle': 'قالب دراسة الجدوى',
    'skipDraftRestore': True
  },
  'feasibility-template-real-estate': {
    'name': 'feasibility-template-real-estate',
    'v3': {'capital':'#capital-invested','revenue':'#total-revenue','profit':'#net-profit','sector':'#cover-business-name','activity':'#cover-idea'},
    'saveTitle': 'قالب دراسة الجدوى العقارية',
    'skipDraftRestore': True
  }
}

EN_TITLES = {
  'creditworthiness': 'Credit Analysis',
  'dashboard': None,
  'dish-margin': 'Dish Margin',
  'invoice-analyzer': 'Invoice Analyzer',
  'manufacturing-feasibility': 'Manufacturing Feasibility',
  'medical-viability': 'Medical Viability',
  'menu-engineering-simple': None,
  'menu-engineering': 'Menu Engineering',
  'real-project-analysis': 'Real Project Analysis',
  'restaurant': 'Restaurant Calculator',
  'feasibility-template': 'Feasibility Template',
  'feasibility-template-real-estate': 'Real Estate Feasibility Template'
}

def build_config(path):
    # path like calculators/creditworthiness.html or en/calculators/creditworthiness.html
    base = os.path.basename(path).replace('.html','')
    cfg = dict(BASE_CONFIGS.get(base, {'name': base, 'v3': {}}))
    if path.startswith('en/'):
        cfg['lang'] = 'en'
        cfg['rel'] = '../../calculators/'
        if EN_TITLES.get(base):
            cfg['saveTitle'] = EN_TITLES[base]
    else:
        cfg['lang'] = 'ar'
        cfg['rel'] = ''
    return cfg

def remove_script_tag(text, pattern):
    # Remove script tags whose src contains pattern
    return re.sub(r'<script[^>]*src=["\'][^"\']*' + re.escape(pattern) + r'[^"\']*["\'][^>]*>\s*</script>', '', text, flags=re.I)

def remove_require_tier(text):
    # Remove blocks like: if (typeof window.requireTier === 'function') { window.requireTier('paidCalculators'); }
    text = re.sub(
        r"if\s*\(\s*typeof\s+window\.requireTier\s*===\s*['\"]function['\"]\s*\)\s*\{\s*window\.requireTier\s*\(\s*['\"]paidCalculators['\"]\s*\)\s*;?\s*\}",
        '', text, flags=re.S)
    # Also remove any remaining standalone requireTier('paidCalculators');
    text = re.sub(r"window\.requireTier\s*\(\s*['\"]paidCalculators['\"]\s*\)\s*;?", '', text)
    return text

def helper_block(cfg):
    rel = cfg.get('rel','')
    cfg_script = json.dumps(cfg, ensure_ascii=False)
    return (
      f'<script src="{rel}shared-analytics.js"></script>\n'
      f'<script src="{rel}auth-modal.js"></script>\n'
      f'<script src="{rel}exit-intent.js"></script>\n'
      f'<script src="{rel}anonymous-first.js"></script>\n'
      f'<script>\n'
      f'  window.__bondsCalcConfig = {cfg_script};\n'
      f'  BondsAnonymousFirst.init(window.__bondsCalcConfig);\n'
      f'</script>\n'
    )

def process_file(path):
    full = os.path.join(BASE, path)
    with open(full, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    if 'anonymous-first.js' in text:
        print('SKIP already processed:', path)
        return

    text = remove_script_tag(text, 'auth-gate')
    text = remove_script_tag(text, 'auth-guard')
    text = remove_require_tier(text)

    cfg = build_config(path)
    block = helper_block(cfg)

    # Insert before the closing </body> tag (last occurrence)
    m = list(re.finditer(r'</body>', text, re.I))
    if m:
        pos = m[-1].start()
        text = text[:pos] + '\n' + block + text[pos:]
    else:
        text = text + '\n' + block

    with open(full, 'w', encoding='utf-8') as f:
        f.write(text)
    print('UPDATED', path)

def main():
    for t in TARGETS:
        process_file(t)

if __name__ == '__main__':
    main()
