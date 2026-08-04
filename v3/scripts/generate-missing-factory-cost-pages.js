/**
 * Generate missing factory-cost pages for countries that don't have one.
 */
const fs = require('fs');
const path = require('path');

const { ARAB_COUNTRIES_GEO } = require('../master-data/countries-governorates-cities.js');

function getFactoryCostCities(code) {
  const baseRent = {
    PS: 45, DJ: 30, SO: 20, MR: 25, KM: 20
  }[code] || 25;
  const country = ARAB_COUNTRIES_GEO[code];
  const cities = {};
  country.governorates.forEach((gov, govIdx) => {
    gov.cities.forEach((city, cityIdx) => {
      const variation = 1 + ((govIdx + cityIdx) % 5) * 0.05;
      cities[city.code] = { name: city.name, rent: Math.round(baseRent * variation) };
    });
  });
  return cities;
}

const existing = fs.readdirSync(path.join(__dirname, '..', '..', 'calculators'))
  .filter(f => f.startsWith('factory-cost-') && f.endsWith('.html'))
  .map(f => f.replace('factory-cost-', '').replace('.html', ''));

const allCountries = Object.keys(ARAB_COUNTRIES_GEO);
const missing = allCountries.filter(c => !existing.includes(c.toLowerCase()) && c !== 'SA');

const template = (code, country, citiesOptions) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>حاسبة تكلفة المصنع المتقدمة - ${country.name} | بوندز</title>
  <meta name="description" content="احسب تكلفة إنشاء مصنع في ${country.name} - رواتب، تأمين، مواد خام، سيناريوهات" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="icon" href="../assets/bonds-mark.svg" type="image/png" />
  <style>
    :root {
      --bg: #f5f0e8; --bg-secondary: #ffffff; --bg-card: rgba(255,255,255,0.85);
      --gold: #b8954e; --gold-bright: #d4b87a; --gold-dim: #8a7340;
      --text: #1a1a1a; --text-secondary: #555555; --text-muted: #888888;
      --border: rgba(0,0,0,0.08); --border-hover: rgba(184,149,78,0.4);
      --success: #22c55e; --warning: #eab308; --info: #3b82f6; --danger: #ef4444;
      --radius: 16px; --shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Vazirmatn',system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.7; }
    a { color:var(--gold); text-decoration:none; }
    .header { background:var(--bg-secondary); border-bottom:1px solid var(--border); padding:1rem 1.5rem; position:sticky; top:0; z-index:100; }
    .header__inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; }
    .header__logo { display:flex; align-items:center; gap:0.75rem; }
    .header__logo img { height:40px; border-radius:6px; }
    .header__logo span { font-weight:800; color:var(--gold); }
    .header__nav { display:flex; gap:1.5rem; }
    .header__nav a { color:var(--text-secondary); font-weight:600; font-size:0.85rem; transition:0.3s; }
    .header__nav a:hover { color:var(--gold); }
    .hero { background:linear-gradient(135deg, rgba(212,168,83,0.1), transparent), var(--bg-secondary); padding:4rem 1.5rem; text-align:center; border-bottom:1px solid var(--border); }
    .hero h1 { font-size:2rem; font-weight:800; margin-bottom:0.75rem; }
    .hero p { color:var(--text-secondary); max-width:700px; margin:0 auto; }
    .container { max-width:1200px; margin:0 auto; padding:3rem 1.5rem; }
    .section-title { font-size:1.4rem; font-weight:800; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem; color:var(--gold); }
    .calc-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
    @media (max-width:768px) { .calc-grid { grid-template-columns:1fr; } }
    .input-group { margin-bottom:1.25rem; }
    .input-group label { display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem; }
    .input-group input, .input-group select {
      width:100%; padding:1rem 1.25rem; border-radius:12px; border:1px solid rgba(0,0,0,0.2);
      background:#ffffff; color:var(--text); font-family:inherit; font-size:1rem; transition:0.3s;
    }
    .input-group input:focus, .input-group select:focus { outline:none; border-color:var(--gold); box-shadow:0 0 0 3px rgba(212,168,83,0.1); }
    .input-group small { color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.25rem; }
    .input-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    @media (max-width:768px) { .input-row { grid-template-columns:1fr; } }
    .card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:1.75rem; transition:0.3s; }
    .card:hover { border-color:var(--gold); box-shadow:var(--shadow); }
    .scenario-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem; }
    @media (max-width:768px) { .scenario-cards { grid-template-columns:1fr; } }
    .scenario-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem; text-align:center; }
    .scenario-card.pessimistic { border-color:rgba(239,68,68,0.3); }
    .scenario-card.expected { border-color:var(--gold); }
    .scenario-card.optimistic { border-color:rgba(34,197,94,0.3); }
    .scenario-card .scenario-label { font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem; }
    .scenario-card.pessimistic .scenario-label { color:var(--danger); }
    .scenario-card.expected .scenario-label { color:var(--gold); }
    .scenario-card.optimistic .scenario-label { color:var(--success); }
    .scenario-card .scenario-value { font-size:1.5rem; font-weight:800; }
    .results { display:none; }
    .results.show { display:block; animation:fadeIn 0.5s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .result-summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:2rem; }
    .result-box { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem; text-align:center; }
    .result-box .value { font-size:1.6rem; font-weight:800; color:var(--gold); }
    .result-box .label { font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem; }
    .table-wrap { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; margin-bottom:2rem; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:right; padding:1rem 1.5rem; font-size:0.8rem; font-weight:700; color:var(--gold); background:rgba(184,149,78,0.15); border-bottom:1px solid var(--border); }
    td { padding:1rem 1.5rem; font-size:0.9rem; color:var(--text-secondary); border-bottom:1px solid var(--border); }
    tr:hover td { background:rgba(212,168,40,0.05); }
    td strong { color:var(--text); }
    .total-row td { font-weight:800; color:var(--gold); background:rgba(212,168,83,0.08); }
    .btn-primary { display:inline-block; background:linear-gradient(135deg, var(--gold), var(--gold-bright)); color:#1a1a1a; font-weight:800; padding:0.9rem 2.5rem; border-radius:12px; text-decoration:none; border:none; cursor:pointer; font-family:inherit; font-size:1rem; }
    .btn-primary:hover { opacity:0.9; }
    .note { background:rgba(234,179,8,0.08); border:1px solid var(--border); border-radius:8px; padding:1rem; font-size:0.85rem; color:var(--text-secondary); margin-top:1rem; }
    .chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:2rem; }
    @media (max-width:768px) { .chart-grid { grid-template-columns:1fr; } }
    .chart-box { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem; }
    .chart-box canvas { max-height:300px; }
    footer { text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem; border-top:1px solid var(--border); margin-top:3rem; }
  </style>
<link rel="stylesheet" href="../header-footer.css?v=2.54.0" />
</head>
<body>
  <div id="site-header"></div>

  <section class="hero">
    <h1>حاسبة تكلفة المصنع المتقدمة - ${country.name}</h1>
    <p>قدر تكاليف إنشاء وتشغيل مصنعك في ${country.name} بدقة - رواتب، تأمين، مواد خام، و3 سيناريوهات</p>
  </section>

  <div class="container">
    <div class="calc-grid">
      <div class="card">
        <h2 class="section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 32c0 2.209-1.791 4-4 4H5c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h22c2.209 0 4 1.791 4 4v28z"/><path fill="#99AAB5" d="M27 24c0 .553-.447 1-1 1H6c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1zm-16 4c0 .553-.448 1-1 1H6c-.552 0-1-.447-1-1 0-.553.448-1 1-1h4c.552 0 1 .447 1 1zM27 8c0 .552-.447 1-1 1H6c-.552 0-1-.448-1-1s.448-1 1-1h20c.553 0 1 .448 1 1zm0 4c0 .553-.447 1-1 1H6c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H6c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H6c-.552 0-1-.447-1-1 0-.553.448-1 1-1h20c.553 0 1 .447 1 1z"/><path fill="#66757F" d="M31 6.272c-.827-.535-1.837-.579-2.521-.023l-.792.646-1.484 1.211-.1.08-2.376 1.938-11.878 9.686c-.437.357-.793 1.219-1.173 2.074-.378.85-.969 2.852-1.443 4.391-.148.25-1.065 1.846-.551 2.453.52.615 2.326.01 2.568-.076 1.626-.174 3.731-.373 4.648-.58.924-.211 1.854-.395 2.291-.752.008-.006.01-.018.017-.023l11.858-9.666.792-.646.144-.118V6.272z"/><path fill="#D99E82" d="M18.145 22.526s-1.274-1.881-2.117-2.553c-.672-.843-2.549-2.116-2.549-2.116-.448-.446-1.191-.48-1.629-.043-.437.438-.793 1.366-1.173 2.291-.472 1.146-1.276 4.154-1.768 5.752-.083.272.517-.45.503-.21-.01.187.027.394.074.581l-.146.159.208.067c.025.082.05.154.068.21l.159-.146c.187.047.394.084.58.074.24-.014-.483.587-.21.503 1.598-.493 4.607-1.296 5.752-1.768.924-.381 1.854-.736 2.291-1.174.439-.435.406-1.178-.043-1.627z"/><path fill="#EA596E" d="M25.312 4.351c-.876.875-.876 2.293 0 3.168l3.167 3.168c.876.874 2.294.874 3.168 0l3.169-3.168c.874-.875.874-2.293 0-3.168l-3.169-3.168c-.874-.875-2.292-.875-3.168 0l-3.167 3.168z"/><path fill="#FFCC4D" d="M11.849 17.815l3.17 3.17 3.165 3.166 11.881-11.879-6.337-6.336-11.879 11.879z"/><path fill="#292F33" d="M11.298 26.742s-2.06 1.133-2.616.576c-.557-.558.581-2.611.581-2.611s1.951.036 2.035 2.035z"/><path fill="#CCD6DD" d="M23.728 5.935l3.96-3.96 6.336 6.337-3.96 3.96z"/><path fill="#99AAB5" d="M26.103 3.558l.792-.792 6.336 6.335-.792.792zM24.52 5.142l.791-.791 6.336 6.335-.792.792z"/></svg> بيانات المصنع</h2>
        <div class="input-group">
          <label for="city">المنطقة الصناعية / المدينة</label>
          <select id="city">
${citiesOptions}
          </select>
        </div>
        <div class="input-group">
          <label for="industry">نوع الصناعة</label>
          <select id="industry">
            <option value="food">غذائية ومشروبات</option>
            <option value="plastic">بلاستيك وتعبئة</option>
            <option value="metal">معدنية</option>
            <option value="electronics">إلكترونيات</option>
            <option value="textile">نسيج</option>
            <option value="furniture">أثاث</option>
            <option value="pharma">أدوية</option>
            <option value="building">مواد بناء</option>
          </select>
        </div>
        <div class="input-group">
          <label for="type">نوع المنشأة</label>
          <select id="type">
            <option value="land">أرض صناعية</option>
            <option value="hangar">مستودع/هنجر</option>
            <option value="ready">مصنع جاهز</option>
            <option value="build">بناء من الصفر</option>
          </select>
        </div>
        <div class="input-group">
          <label for="area">المساحة (م²)</label>
          <input type="number" id="area" placeholder="1000" min="100" step="100" />
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="localWorkers">عدد العمال المحليين</label>
            <input type="number" id="localWorkers" placeholder="5" min="0" />
          </div>
          <div class="input-group">
            <label for="expatWorkers">عدد العمال الوافدين</label>
            <input type="number" id="expatWorkers" placeholder="10" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="localSalary">متوسط الراتب المحلي (${country.currencySymbol})</label>
            <input type="number" id="localSalary" placeholder="3000" min="0" />
          </div>
          <div class="input-group">
            <label for="expatSalary">متوسط راتب الوافد (${country.currencySymbol})</label>
            <input type="number" id="expatSalary" placeholder="1500" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="electricity">استهلاك الكهرباء الشهري (ك.و.س)</label>
            <input type="number" id="electricity" placeholder="5000" min="0" step="500" />
          </div>
          <div class="input-group">
            <label for="water">استهلاك الماء الشهري (م³)</label>
            <input type="number" id="water" placeholder="100" min="0" step="10" />
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> التكاليف والإنتاج</h2>
        <div class="input-row">
          <div class="input-group">
            <label for="monthlyProduction">الإنتاج الشهري (وحدة)</label>
            <input type="number" id="monthlyProduction" placeholder="10000" min="0" />
          </div>
          <div class="input-group">
            <label for="unitPrice">سعر الوحدة (${country.currencySymbol})</label>
            <input type="number" id="unitPrice" placeholder="50" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="rawMaterialPct">نسبة المواد الأولية (%)</label>
            <input type="number" id="rawMaterialPct" placeholder="اتركه فارغاً للحساب التلقائي" min="0" max="100" />
          </div>
          <div class="input-group">
            <label for="maintenancePct">الصيانة السنوية (% من قيمة المنشأة)</label>
            <input type="number" id="maintenancePct" placeholder="2" min="0" max="20" />
          </div>
        </div>
        <div class="input-group">
          <label for="insurancePct">التأمين السنوي (% من قيمة المنشأة)</label>
          <input type="number" id="insurancePct" placeholder="0.5" min="0" max="10" />
        </div>
        <button class="btn-primary" onclick="calculate()" style="width:100%"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#A0041E" d="M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z"/><path fill="#FFAC33" d="M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z"/><circle fill="#FFCC4D" cx="8.999" cy="27" r="4"/><path fill="#55ACEE" d="M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z"/><path d="M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z"/><path fill="#A0041E" d="M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z"/></svg> احسب التكلفة</button>
      </div>
    </div>

    <div id="results" class="results">
      <h2 class="section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#DD2E44" d="M4.998 33c-.32 0-.645-.076-.946-.239-.973-.523-1.336-1.736-.813-2.709l7-13c.299-.557.845-.939 1.47-1.031.626-.092 1.258.118 1.705.565l6.076 6.076 9.738-18.59c.512-.978 1.721-1.357 2.699-.843.979.512 1.356 1.721.844 2.7l-11 21c-.295.564-.841.953-1.47 1.05-.627.091-1.266-.113-1.716-.563l-6.1-6.099-5.724 10.631C6.4 32.619 5.71 33 4.998 33z"/></svg> ملخص التكاليف</h2>
      <div class="scenario-cards">
        <div class="scenario-card pessimistic">
          <div class="scenario-label">سيناريو متشائم</div>
          <div class="scenario-value" id="pessimistic">0</div>
        </div>
        <div class="scenario-card expected">
          <div class="scenario-label">سيناريو متوقع</div>
          <div class="scenario-value" id="expected">0</div>
        </div>
        <div class="scenario-card optimistic">
          <div class="scenario-label">سيناريo متفائل</div>
          <div class="scenario-value" id="optimistic">0</div>
        </div>
      </div>

      <div class="result-summary">
        <div class="result-box">
          <div class="value" id="totalMonthly">0</div>
          <div class="label">الشهري (${country.currencySymbol})</div>
        </div>
        <div class="result-box">
          <div class="value" id="totalYearly">0</div>
          <div class="label">السنوي (${country.currencySymbol})</div>
        </div>
        <div class="result-box">
          <div class="value" id="setupCost">0</div>
          <div class="label">تكلفة التأسيس</div>
        </div>
        <div class="result-box">
          <div class="value" id="costPerUnit">0</div>
          <div class="label">تكلفة الوحدة</div>
        </div>
      </div>

      <h2 class="section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#C1694F" d="M32 34c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2V7c0-1.104.896-2 2-2h24c1.104 0 2 .896 2 2v27z"/><path fill="#FFF" d="M29 32c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1V9c0-.552.448-1 1-1h20c.553 0 1 .448 1 1v23z"/><path fill="#CCD6DD" d="M25 3h-4c0-1.657-1.343-3-3-3s-3 1.343-3 3h-4c-1.104 0-2 .896-2 2v5h18V5c0-1.104-.896-2-2-2z"/><circle fill="#292F33" cx="18" cy="3" r="2"/><path fill="#99AAB5" d="M20 14c0 .552-.447 1-1 1h-9c-.552 0-1-.448-1-1s.448-1 1-1h9c.553 0 1 .448 1 1zm7 4c0 .552-.447 1-1 1H10c-.552 0-1-.448-1-1s.448-1 1-1h16c.553 0 1 .448 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1h-9c-.552 0-1-.447-1-1 0-.553.448-1 1-1h9c.553 0 1 .447 1 1z"/></svg> تفصيل التكاليف الشهرية</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>البند</th><th>الشهري</th><th>السنوي</th><th>النسبة</th></tr></thead>
          <tbody id="breakdownTable"></tbody>
        </table>
      </div>

      <h2 class="section-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#66757F" d="M28.25 8.513c0-.145-.117-.263-.263-.263h-.475c-.145 0-.263.118-.263.263v11.475c0 .145.117.263.263.263h.475c.145 0 .263-.117.263-.263V8.513z"/><g fill="#F19020"><circle cx="27.75" cy="19.75" r="1.5"/><circle cx="27.75" cy="22.25" r="1"/></g><path fill="#BD2032" d="M33.25 8.25h-4.129L9.946.29 9.944.289h-.001c-.016-.007-.032-.005-.047-.01C9.849.265 9.802.25 9.75.25h-.002c-.066 0-.13.014-.19.038-.045.02-.084.05-.122.082-.012.009-.026.014-.037.025-.047.046-.085.102-.11.164V.56c-.004.009-.003.02-.006.029l-5.541 7.81c-.003.004-.003.01-.006.014-.285.176-.486.477-.486.837v2c0 .552.448 1 1 1h1.495L2.031 34H.25v2h18.958v-2h-1.74l-3.713-21.75H33.25c.553 0 1-.448 1-1v-2c0-.552-.447-1-1-1zm-21.769 4L9.75 13.639 8.02 12.25h3.461zM9.75 21.3l3.667 2.404-3.667 2-3.667-2L9.75 21.3zm-3.639.71l.474-2.784 1.866 1.223-2.34 1.561zm4.938-1.561l1.87-1.225.477 2.789-2.347-1.564zm-1.299-.866l-2.828-1.885 2.828-2.322 2.828 2.322-2.828 1.885zm-2.563-3.887l.362-2.127 1.131.928-1.493 1.199zm3.633-1.198l1.132-.929.364 2.13-1.496-1.201zM5.073 8.25L9.25 2.362V6.25h-2c-.552 0-1 .448-1 1v1H5.073zm.53 16.738l2.73 1.489-3.29 1.794.56-3.283zM15.443 34H4.067l.686-4.024L9.75 27.25l5.006 2.731.687 4.019zm-1.54-9.015l.562 3.291-3.298-1.799 2.736-1.492zM13.25 8.25v-1c0-.552-.448-1-1-1h-2V1.499L26.513 8.25H13.25zm2 3h-1.16v-2h1.16v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3-.5c0 .276-.224.5-.5.5h-1.5v-2h1.5c.276 0 .5.224.5.5v1z"/><path fill="#4B545D" d="M12.25 7.25h-2c-.552 0-1 .448-1 1v2c0 .552.448 1 1 1h3v-4h-1z"/><path fill="#CDD7DF" d="M11.25 7.25h2v4h-2z"/><path fill="#66757F" d="M34.844 24v-1H20.656v1h.844v2.469h-.844v1h14.188v-1H34V24z"/></svg> تكاليف التأسيس (مرة واحدة)</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>البند</th><th>التكلفة</th><th>ملاحظات</th></tr></thead>
          <tbody id="setupTable"></tbody>
        </table>
      </div>
      <div class="note">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> هذه التقديرات تقريبية بناءً على متوسطات السوق في ${country.name}. الأسعار الفعلية تختلف حسب الموقع والنشاط والمفاوضات. يُنصح بمراجعة التقديرات مع مستشار مالي.
      </div>
    </div>
  </div>

  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="../v3/master-data/countries-governorates-cities.js"></script>
  <script src="factory-cost-shared.js"></script>
  <script>
    const COUNTRY_CODE = '${code}';
    const CURRENCY = '${country.currencySymbol}';
    const cityRates = window.FactoryCostShared.getCountryCities(COUNTRY_CODE) || {};

    const citySelect = document.getElementById('city');
    citySelect.innerHTML = '';
    Object.keys(cityRates).forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = cityRates[code].name;
      citySelect.appendChild(opt);
    });

    const typeMultipliers = {
      land: 1,
      hangar: 1.3,
      ready: 1.8,
      build: 2.5
    };

    const industryProfiles = {
      food: { rawMatPct: 35, elecMult: 1.0, name: 'غذائية' },
      plastic: { rawMatPct: 50, elecMult: 1.4, name: 'بلاستيك' },
      metal: { rawMatPct: 42, elecMult: 1.6, name: 'معدنية' },
      electronics: { rawMatPct: 32, elecMult: 0.8, name: 'إلكترونيات' },
      textile: { rawMatPct: 36, elecMult: 1.0, name: 'نسيج' },
      furniture: { rawMatPct: 30, elecMult: 0.7, name: 'أثاث' },
      pharma: { rawMatPct: 28, elecMult: 0.9, name: 'أدوية' },
      building: { rawMatPct: 38, elecMult: 1.3, name: 'مواد بناء' }
    };

    function fmt(n) {
      return Math.round(n).toLocaleString('ar-SA');
    }

    function calculate() {
      const cityKey = document.getElementById('city').value;
      const industryKey = document.getElementById('industry').value;
      const area = parseFloat(document.getElementById('area').value) || 0;
      const type = document.getElementById('type').value;
      const localWorkers = parseInt(document.getElementById('localWorkers').value) || 0;
      const expatWorkers = parseInt(document.getElementById('expatWorkers').value) || 0;
      const localSalary = parseFloat(document.getElementById('localSalary').value) || 0;
      const expatSalary = parseFloat(document.getElementById('expatSalary').value) || 0;
      const electricity = parseFloat(document.getElementById('electricity').value) || 0;
      const water = parseFloat(document.getElementById('water').value) || 0;
      const monthlyProduction = parseFloat(document.getElementById('monthlyProduction').value) || 0;
      const maintenancePct = parseFloat(document.getElementById('maintenancePct').value) || 0;
      const insurancePct = parseFloat(document.getElementById('insurancePct').value) || 0;
      const rawMaterialPct = parseFloat(document.getElementById('rawMaterialPct').value) || 0;
      const unitPrice = parseFloat(document.getElementById('unitPrice').value) || 0;

      const city = cityRates[cityKey];
      if (!city) { alert('اختر المدينة أولاً'); return; }
      const mult = typeMultipliers[type];
      const industry = industryProfiles[industryKey];
      const effectiveRawMatPct = rawMaterialPct > 0 ? rawMaterialPct : industry.rawMatPct;

      const rentMonthly = city.rent * area * mult / 12;
      const electricityMonthly = electricity * 0.20 * industry.elecMult;
      const waterMonthly = water * 1.5;
      const supervisionMonthly = area * 0.20 / 12;
      const licenseMonthly = area * 0.05 / 12 / 5;

      const localPayroll = localWorkers * localSalary;
      const expatPayroll = expatWorkers * expatSalary;
      const totalLabor = localPayroll + expatPayroll;

      const facilityValue = area * city.rent * mult * 10;
      const maintenanceMonthly = (facilityValue * maintenancePct / 100) / 12;
      const insuranceMonthly = (facilityValue * insurancePct / 100) / 12;

      const monthlyRevenue = monthlyProduction * unitPrice;
      const rawMaterialMonthly = monthlyRevenue * (effectiveRawMatPct / 100);

      const totalMonthly = rentMonthly + electricityMonthly + waterMonthly + supervisionMonthly + licenseMonthly + totalLabor + maintenanceMonthly + insuranceMonthly + rawMaterialMonthly;
      const totalYearly = totalMonthly * 12;

      const planApproval = Math.min(Math.max(area * 1, 5000), 25000);
      const deposit = area * city.rent * mult * 2;
      const electricityConnection = Math.min(Math.max(electricity * 0.5, 3000), 50000);
      const civilDefense = 2000;
      const buildingPermit = area * 2;
      const basicInsurance = facilityValue * 0.05;
      const miscSetup = 15000;
      const setupCost = planApproval + deposit + electricityConnection + civilDefense + buildingPermit + basicInsurance + miscSetup;

      const pessimistic = totalYearly * 1.25;
      const optimistic = totalYearly * 0.85;
      const unitCost = monthlyProduction > 0 ? totalMonthly / monthlyProduction : 0;

      document.getElementById('pessimistic').textContent = fmt(pessimistic) + ' ' + CURRENCY;
      document.getElementById('expected').textContent = fmt(totalYearly) + ' ' + CURRENCY;
      document.getElementById('optimistic').textContent = fmt(optimistic) + ' ' + CURRENCY;
      document.getElementById('totalMonthly').textContent = fmt(totalMonthly);
      document.getElementById('totalYearly').textContent = fmt(totalYearly);
      document.getElementById('setupCost').textContent = fmt(setupCost);
      document.getElementById('costPerUnit').textContent = fmt(unitCost);

      const pct = v => totalMonthly > 0 ? (v / totalMonthly * 100).toFixed(1) + '%' : '0%';
      document.getElementById('breakdownTable').innerHTML = \`
        <tr><td><strong>إيجار \${city.name}</strong></td><td>\${fmt(rentMonthly)}</td><td>\${fmt(rentMonthly*12)}</td><td>\${pct(rentMonthly)}</td></tr>
        <tr><td>كهرباء (\${fmt(electricity)} ك.و.س)</td><td>\${fmt(electricityMonthly)}</td><td>\${fmt(electricityMonthly*12)}</td><td>\${pct(electricityMonthly)}</td></tr>
        <tr><td>ماء (\${fmt(water)} م³)</td><td>\${fmt(waterMonthly)}</td><td>\${fmt(waterMonthly*12)}</td><td>\${pct(waterMonthly)}</td></tr>
        <tr><td>إشراف وتشغيل</td><td>\${fmt(supervisionMonthly)}</td><td>\${fmt(supervisionMonthly*12)}</td><td>\${pct(supervisionMonthly)}</td></tr>
        <tr><td>تراخيص سنوية</td><td>\${fmt(licenseMonthly)}</td><td>\${fmt(licenseMonthly*12)}</td><td>\${pct(licenseMonthly)}</td></tr>
        <tr><td>العمالة</td><td>\${fmt(totalLabor)}</td><td>\${fmt(totalLabor*12)}</td><td>\${pct(totalLabor)}</td></tr>
        <tr><td>صيانة</td><td>\${fmt(maintenanceMonthly)}</td><td>\${fmt(maintenanceMonthly*12)}</td><td>\${pct(maintenanceMonthly)}</td></tr>
        <tr><td>تأمين</td><td>\${fmt(insuranceMonthly)}</td><td>\${fmt(insuranceMonthly*12)}</td><td>\${pct(insuranceMonthly)}</td></tr>
        <tr><td>مواد أولية</td><td>\${fmt(rawMaterialMonthly)}</td><td>\${fmt(rawMaterialMonthly*12)}</td><td>\${pct(rawMaterialMonthly)}</td></tr>
        <tr class="total-row"><td><strong>الإجمالي</strong></td><td><strong>\${fmt(totalMonthly)}</strong></td><td><strong>\${fmt(totalYearly)}</strong></td><td>100%</td></tr>
      \`;

      document.getElementById('setupTable').innerHTML = \`
        <tr><td>رسوم الموافقة على المخطط</td><td>\${fmt(planApproval)} \${CURRENCY}</td><td>مرة واحدة</td></tr>
        <tr><td>تأمين إيجار (شهرين)</td><td>\${fmt(deposit)} \${CURRENCY}</td><td>حسب المساحة</td></tr>
        <tr><td>رسوم توصيل كهرباء</td><td>\${fmt(electricityConnection)} \${CURRENCY}</td><td>حسب الاستهلاك</td></tr>
        <tr><td>دفاع مدني</td><td>\${fmt(civilDefense)} \${CURRENCY}</td><td>ثابتة</td></tr>
        <tr><td>ترخيص بناء</td><td>\${fmt(buildingPermit)} \${CURRENCY}</td><td>حسب المساحة</td></tr>
        <tr><td>تأمين أساسي</td><td>\${fmt(basicInsurance)} \${CURRENCY}</td><td>سنوي مقدماً</td></tr>
        <tr><td>مصاريف متنوعة</td><td>\${fmt(miscSetup)} \${CURRENCY}</td><td>تقديرية</td></tr>
      \`;

      document.getElementById('results').classList.add('show');
    }
  </script>

  <script src="../shared-utils.js"></script>
  <script src="../script.js"></script>
</body>
</html>
`;

console.log('Missing factory-cost pages:', missing);

for (const code of missing) {
  const country = ARAB_COUNTRIES_GEO[code];
  const cities = getFactoryCostCities(code);
  const citiesOptions = Object.keys(cities).map(cityCode => {
    return `            <option value="${cityCode}">${cities[cityCode].name}</option>`;
  }).join('\n');
  const html = template(code, country, citiesOptions);
  const filePath = path.join(__dirname, '..', '..', 'calculators', `factory-cost-${code.toLowerCase()}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Created ${filePath}`);
}
