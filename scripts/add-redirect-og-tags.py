from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IMAGE = 'https://bonds-global.com/assets/bonds-logo-2026.webp'

def redirect_page(lang, title, target_url, canonical):
    ar = lang == 'ar'
    desc = title
    return f'''<!DOCTYPE html>
<html lang="{lang}" dir="{'rtl' if ar else 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url={target_url}" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:image" content="{IMAGE}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{IMAGE}" />
</head>
<body>
  <p>{'جاري تحويلك إلى' if ar else 'Redirecting to'} <a href="{target_url}">{title}</a>...</p>
</body>
</html>
'''

# Root redirects
(ROOT / 'calculator-v2.html').write_text(
    redirect_page('ar', 'آلة حاسبة نقطة التعادل | بوندز', '/calculator.html', 'https://bonds-global.com/calculator'), encoding='utf-8')
(ROOT / 'en' / 'calculator-v2.html').write_text(
    redirect_page('en', 'Break-even Calculator | Bonds', '/en/calculator.html', 'https://bonds-global.com/en/calculator'), encoding='utf-8')
(ROOT / 'auth.html').write_text(
    redirect_page('ar', 'تسجيل الدخول | بوندز', '/calculators/auth/index.html', 'https://bonds-global.com/calculators/auth/'), encoding='utf-8')
(ROOT / 'auth-v2.html').write_text(
    redirect_page('ar', 'تسجيل الدخول | بوندز', '/calculators/auth/index.html', 'https://bonds-global.com/calculators/auth/'), encoding='utf-8')
(ROOT / 'en' / 'auth-v2.html').write_text(
    redirect_page('en', 'Sign In | Bonds', '/en/calculators/auth/index.html', 'https://bonds-global.com/en/calculators/auth/'), encoding='utf-8')
(ROOT / 'calculators' / 'menu-engineering-simple.html').write_text(
    redirect_page('ar', 'محرك هندسة المنيو | بوندز', 'menu-engineering.html', 'https://bonds-global.com/calculators/menu-engineering'), encoding='utf-8')
(ROOT / 'en' / 'calculators' / 'menu-engineering-simple.html').write_text(
    redirect_page('en', 'Menu Engineering Engine | Bonds', 'menu-engineering.html', 'https://bonds-global.com/en/calculators/menu-engineering'), encoding='utf-8')

# Factory-cost redirects
codes = ['ae','bh','dj','dz','eg','iq','jo','km','kw','lb','ly','ma','mr','om','ps','qa','sd','so','sy','tn','ye']
for code in codes:
    c = code.upper()
    (ROOT / 'calculators' / f'factory-cost-{code}.html').write_text(
        redirect_page('ar', f'حاسبة تكلفة المصنع - {c} | بوندز', f'factory-cost.html?country={c}', f'https://bonds-global.com/calculators/factory-cost?country={c}'), encoding='utf-8')
    (ROOT / 'en' / 'calculators' / f'factory-cost-{code}.html').write_text(
        redirect_page('en', f'Factory Cost Calculator - {c} | Bonds', f'factory-cost.html?country={c}', f'https://bonds-global.com/en/calculators/factory-cost?country={c}'), encoding='utf-8')

print('Regenerated redirect pages with OG tags')
