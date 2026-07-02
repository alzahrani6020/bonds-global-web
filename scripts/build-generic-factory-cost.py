import re, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent

COUNTRIES_AR = [
    ('SA','السعودية'), ('AE','الإمارات'), ('BH','البحرين'), ('KW','الكويت'),
    ('QA','قطر'), ('OM','عمان'), ('EG','مصر'), ('JO','الأردن'), ('IQ','العراق'),
    ('LB','لبنان'), ('SY','سوريا'), ('PS','فلسطين'), ('TN','تونس'), ('DZ','الجزائر'),
    ('MA','المغرب'), ('LY','ليبيا'), ('SD','السودان'), ('YE','اليمن'), ('DJ','جيبوتي'),
    ('SO','الصومال'), ('MR','موريتانيا'), ('KM','جزر القمر')
]

COUNTRIES_EN = [
    ('SA','Saudi Arabia'), ('AE','UAE'), ('BH','Bahrain'), ('KW','Kuwait'),
    ('QA','Qatar'), ('OM','Oman'), ('EG','Egypt'), ('JO','Jordan'), ('IQ','Iraq'),
    ('LB','Lebanon'), ('SY','Syria'), ('PS','Palestine'), ('TN','Tunisia'), ('DZ','Algeria'),
    ('MA','Morocco'), ('LY','Libya'), ('SD','Sudan'), ('YE','Yemen'), ('DJ','Djibouti'),
    ('SO','Somalia'), ('MR','Mauritania'), ('KM','Comoros')
]

def build_country_options(countries, lang):
    first = '<option value="">' + ('اختر البلد' if lang=='ar' else 'Select country') + '</option>\n'
    return first + '\n'.join(f'            <option value="{code}">{name}</option>' for code,name in countries)

def transform(content, lang, countries):
    ar = lang == 'ar'
    # title & meta
    content = re.sub(r'<title>.*?</title>', '<title>' + ('حاسبة تكلفة المصنع المتقدمة | بوندز' if ar else 'Advanced Factory Cost Calculator | Bonds') + '</title>', content)
    content = re.sub(r'<meta name="description" content=".*?"', '<meta name="description" content="' + ('احسب تكلفة إنشاء وتشغيل مصنعك في 22 دولة عربية - رواتب، تأمين، مواد خام، سيناريوهات' if ar else 'Calculate factory setup and operating costs across 22 Arab countries - salaries, insurance, raw materials, scenarios') + '"', content)
    # canonical / og:url
    canonical = '/calculators/factory-cost' if ar else '/en/calculators/factory-cost'
    content = re.sub(r'<link rel="canonical" href="https://bonds-global\.com/[^"]+"', f'<link rel="canonical" href="https://bonds-global.com{canonical}"', content)
    content = re.sub(r'<meta property="og:url" content="https://bonds-global\.com/[^"]+"', f'<meta property="og:url" content="https://bonds-global.com{canonical}"', content)
    content = re.sub(r'<meta property="og:title" content=".*?"', '<meta property="og:title" content="' + ('حاسبة تكلفة المصنع المتقدمة | بوندز' if ar else 'Advanced Factory Cost Calculator | Bonds') + '"', content)
    content = re.sub(r'<meta property="og:description" content=".*?"', '<meta property="og:description" content="' + ('احسب تكلفة إنشاء وتشغيل مصنعك في 22 دولة عربية - رواتب، تأمين، مواد خام، سيناريوهات' if ar else 'Calculate factory setup and operating costs across 22 Arab countries - salaries, insurance, raw materials, scenarios') + '"', content)
    content = re.sub(r'<meta name="twitter:title" content=".*?"', '<meta name="twitter:title" content="' + ('حاسبة تكلفة المصنع المتقدمة | بوندز' if ar else 'Advanced Factory Cost Calculator | Bonds') + '"', content)
    content = re.sub(r'<meta name="twitter:description" content=".*?"', '<meta name="twitter:description" content="' + ('احسب تكلفة إنشاء وتشغيل مصنعك في 22 دولة عربية - رواتب، تأمين، مواد خام، سيناريوهات' if ar else 'Calculate factory setup and operating costs across 22 Arab countries - salaries, insurance, raw materials, scenarios') + '"', content)
    # hero
    content = re.sub(r'<h1>.*?</h1>', '<h1>' + ('حاسبة تكلفة المصنع المتقدمة' if ar else 'Advanced Factory Cost Calculator') + '</h1>', content, count=1)
    content = re.sub(r'<p>.*?</p>', '<p>' + ('قدر تكاليف إنشاء وتشغيل مصنعك في 22 دولة عربية بدقة - رواتب، تأمين، مواد خام، و3 سيناريوهات' if ar else 'Estimate factory setup and operating costs across 22 Arab countries - salaries, insurance, raw materials, and 3 scenarios') + '</p>', content, count=1)
    # replace first city select block with country + city
    city_select_block = re.search(r'<div class="input-group">\s*<label for="city">.*?</label>\s*<select[^>]*id="city"[^>]*>[\s\S]*?</select>\s*</div>', content)
    if not city_select_block:
        raise ValueError('Could not find city select block')
    country_label = 'البلد' if ar else 'Country'
    city_label = 'المنطقة الصناعية / المدينة' if ar else 'Industrial Zone / City'
    opts = build_country_options(countries, lang)
    new_block = f'''<div class="input-group">
          <label for="country">{country_label}</label>
          <select data-universal-dropdown="true" data-ud-search="true" data-ud-sort="true" data-ud-deduplicate="true" data-ud-remove-empty="true" id="country">
{opts}
          </select>
        </div>
        <div class="input-group">
          <label for="city">{city_label}</label>
          <select data-universal-dropdown="true" data-ud-search="true" data-ud-sort="true" data-ud-deduplicate="true" data-ud-remove-empty="true" id="city">
            <option value="">{('اختر البلد أولاً' if ar else 'Select a country first')}</option>
          </select>
        </div>'''
    content = content[:city_select_block.start()] + new_block + content[city_select_block.end():]
    # replace init script
    init_block = re.search(r'<script>\s*FactoryCostCalculator\.init\(\{[\s\S]*?\}\);\s*</script>', content)
    if not init_block:
        raise ValueError('Could not find FactoryCostCalculator.init block')
    if ar:
        new_init = '''<script>
    (function(){
      const lang = 'ar';
      const params = new URLSearchParams(location.search);
      let country = (params.get('country') || 'SA').toUpperCase();
      if (!window.FactoryCostCountries || !window.FactoryCostCountries[lang][country]) country = 'SA';
      const countrySelect = document.getElementById('country');
      const citySelect = document.getElementById('city');
      function initForCountry(code) {
        const cfg = window.FactoryCostCountries && window.FactoryCostCountries[lang][code];
        if (!cfg) return;
        window.FactoryCostCalculator.init(cfg);
      }
      countrySelect.value = country;
      initForCountry(country);
      countrySelect.addEventListener('change', function() {
        const code = this.value;
        if (!code) return;
        initForCountry(code);
      });
    })();
  </script>'''
    else:
        new_init = '''<script>
    (function(){
      const lang = 'en';
      const params = new URLSearchParams(location.search);
      let country = (params.get('country') || 'SA').toUpperCase();
      if (!window.FactoryCostCountries || !window.FactoryCostCountries[lang][country]) country = 'SA';
      const countrySelect = document.getElementById('country');
      function initForCountry(code) {
        const cfg = window.FactoryCostCountries && window.FactoryCostCountries[lang][code];
        if (!cfg) return;
        window.FactoryCostCalculator.init(cfg);
      }
      countrySelect.value = country;
      initForCountry(country);
      countrySelect.addEventListener('change', function() {
        const code = this.value;
        if (!code) return;
        initForCountry(code);
      });
    })();
  </script>'''
    content = content[:init_block.start()] + new_init + content[init_block.end():]
    return content

# Build AR generic page from AE variant
ar_src = ROOT / 'calculators' / 'factory-cost-ae.html'
ar_dst = ROOT / 'calculators' / 'factory-cost.html'
ar_dst.write_text(transform(ar_src.read_text(encoding='utf-8'), 'ar', COUNTRIES_AR), encoding='utf-8')
print('Wrote', ar_dst)

# Build EN generic page from AE variant
en_src = ROOT / 'en' / 'calculators' / 'factory-cost-ae.html'
en_dst = ROOT / 'en' / 'calculators' / 'factory-cost.html'
en_dst.write_text(transform(en_src.read_text(encoding='utf-8'), 'en', COUNTRIES_EN), encoding='utf-8')
print('Wrote', en_dst)
