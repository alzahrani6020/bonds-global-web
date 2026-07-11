/**
 * Generate missing English factory-cost pages.
 */
const fs = require('fs');
const path = require('path');

const { ARAB_COUNTRIES_GEO } = require('../master-data/countries-governorates-cities.js');

function getFactoryCostCities(code) {
  const baseRent = { PS: 45, DJ: 30, SO: 20, MR: 25, KM: 20 }[code] || 25;
  const country = ARAB_COUNTRIES_GEO[code];
  const cities = {};
  country.governorates.forEach((gov, govIdx) => {
    gov.cities.forEach((city, cityIdx) => {
      const variation = 1 + ((govIdx + cityIdx) % 5) * 0.05;
      cities[city.code] = { name: city.nameEn, rent: Math.round(baseRent * variation) };
    });
  });
  return cities;
}

const missing = ['PS', 'DJ', 'SO', 'MR', 'KM'];

const template = (code, country, citiesOptions) => `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Advanced Factory Cost Calculator - ${country.nameEn} | Bonds</title>
  <meta name="description" content="Calculate factory setup and operating costs in ${country.nameEn} - salaries, insurance, raw materials, scenarios" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="icon" href="../../assets/bonds-mark.svg" type="image/png" />
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
    body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.7; }
    a { color:var(--gold); text-decoration:none; }
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
    th { text-align:left; padding:1rem 1.5rem; font-size:0.8rem; font-weight:700; color:var(--gold); background:rgba(184,149,78,0.15); border-bottom:1px solid var(--border); }
    td { padding:1rem 1.5rem; font-size:0.9rem; color:var(--text-secondary); border-bottom:1px solid var(--border); }
    tr:hover td { background:rgba(212,168,40,0.05); }
    td strong { color:var(--text); }
    .total-row td { font-weight:800; color:var(--gold); background:rgba(212,168,83,0.08); }
    .btn-primary { display:inline-block; background:linear-gradient(135deg, var(--gold), var(--gold-bright)); color:#1a1a1a; font-weight:800; padding:0.9rem 2.5rem; border-radius:12px; text-decoration:none; border:none; cursor:pointer; font-family:inherit; font-size:1rem; }
    .btn-primary:hover { opacity:0.9; }
    .note { background:rgba(234,179,8,0.08); border:1px solid var(--border); border-radius:8px; padding:1rem; font-size:0.85rem; color:var(--text-secondary); margin-top:1rem; }
  </style>
<link rel="stylesheet" href="../../header-footer.css?v=2.52.0" />
</head>
<body>
  <div id="site-header"></div>

  <section class="hero">
    <h1>Advanced Factory Cost Calculator - ${country.nameEn}</h1>
    <p>Estimate setup and operating costs for your factory in ${country.nameEn} - salaries, insurance, raw materials, and 3 scenarios</p>
  </section>

  <div class="container">
    <div class="calc-grid">
      <div class="card">
        <h2 class="section-title">📝 Factory Data</h2>
        <div class="input-group">
          <label for="city">Industrial Zone / City</label>
          <select id="city">
${citiesOptions}
          </select>
        </div>
        <div class="input-group">
          <label for="industry">Industry Type</label>
          <select id="industry">
            <option value="food">Food & Beverage</option>
            <option value="plastic">Plastic & Packaging</option>
            <option value="metal">Metal</option>
            <option value="electronics">Electronics</option>
            <option value="textile">Textile</option>
            <option value="furniture">Furniture</option>
            <option value="pharma">Pharmaceuticals</option>
            <option value="building">Building Materials</option>
          </select>
        </div>
        <div class="input-group">
          <label for="type">Facility Type</label>
          <select id="type">
            <option value="land">Industrial Land</option>
            <option value="hangar">Warehouse/Hangar</option>
            <option value="ready">Ready Factory</option>
            <option value="build">Build from Scratch</option>
          </select>
        </div>
        <div class="input-group">
          <label for="area">Area (m²)</label>
          <input type="number" id="area" placeholder="1000" min="100" step="100" />
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="localWorkers">Local Workers</label>
            <input type="number" id="localWorkers" placeholder="5" min="0" />
          </div>
          <div class="input-group">
            <label for="expatWorkers">Expatriate Workers</label>
            <input type="number" id="expatWorkers" placeholder="10" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="localSalary">Average Local Salary (${country.currencySymbolEn})</label>
            <input type="number" id="localSalary" placeholder="3000" min="0" />
          </div>
          <div class="input-group">
            <label for="expatSalary">Average Expat Salary (${country.currencySymbolEn})</label>
            <input type="number" id="expatSalary" placeholder="1500" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="electricity">Monthly Electricity (kWh)</label>
            <input type="number" id="electricity" placeholder="5000" min="0" step="500" />
          </div>
          <div class="input-group">
            <label for="water">Monthly Water (m³)</label>
            <input type="number" id="water" placeholder="100" min="0" step="10" />
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">📊 Costs & Production</h2>
        <div class="input-row">
          <div class="input-group">
            <label for="monthlyProduction">Monthly Production (units)</label>
            <input type="number" id="monthlyProduction" placeholder="10000" min="0" />
          </div>
          <div class="input-group">
            <label for="unitPrice">Unit Price (${country.currencySymbolEn})</label>
            <input type="number" id="unitPrice" placeholder="50" min="0" />
          </div>
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="rawMaterialPct">Raw Material Ratio (%)</label>
            <input type="number" id="rawMaterialPct" placeholder="leave blank for auto" min="0" max="100" />
          </div>
          <div class="input-group">
            <label for="maintenancePct">Annual Maintenance (% of facility value)</label>
            <input type="number" id="maintenancePct" placeholder="2" min="0" max="20" />
          </div>
        </div>
        <div class="input-group">
          <label for="insurancePct">Annual Insurance (% of facility value)</label>
          <input type="number" id="insurancePct" placeholder="0.5" min="0" max="10" />
        </div>
        <button class="btn-primary" onclick="calculate()" style="width:100%">🚀 Calculate Cost</button>
      </div>
    </div>

    <div id="results" class="results">
      <h2 class="section-title">📈 Cost Summary</h2>
      <div class="scenario-cards">
        <div class="scenario-card pessimistic">
          <div class="scenario-label">Pessimistic</div>
          <div class="scenario-value" id="pessimistic">0</div>
        </div>
        <div class="scenario-card expected">
          <div class="scenario-label">Expected</div>
          <div class="scenario-value" id="expected">0</div>
        </div>
        <div class="scenario-card optimistic">
          <div class="scenario-label">Optimistic</div>
          <div class="scenario-value" id="optimistic">0</div>
        </div>
      </div>

      <div class="result-summary">
        <div class="result-box">
          <div class="value" id="totalMonthly">0</div>
          <div class="label">Monthly (${country.currencySymbolEn})</div>
        </div>
        <div class="result-box">
          <div class="value" id="totalYearly">0</div>
          <div class="label">Yearly (${country.currencySymbolEn})</div>
        </div>
        <div class="result-box">
          <div class="value" id="setupCost">0</div>
          <div class="label">Setup Cost</div>
        </div>
        <div class="result-box">
          <div class="value" id="costPerUnit">0</div>
          <div class="label">Cost per Unit</div>
        </div>
      </div>

      <h2 class="section-title">📋 Monthly Cost Breakdown</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Monthly</th><th>Yearly</th><th>Share</th></tr></thead>
          <tbody id="breakdownTable"></tbody>
        </table>
      </div>

      <h2 class="section-title">🏗️ Setup Costs (One-time)</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Cost</th><th>Notes</th></tr></thead>
          <tbody id="setupTable"></tbody>
        </table>
      </div>
      <div class="note">
        ⚠️ These estimates are approximate based on market averages in ${country.nameEn}. Actual prices vary by location, activity, and negotiation. Please review with a financial advisor.
      </div>
    </div>
  </div>

  <div id="site-footer"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="../../v3/master-data/countries-governorates-cities.js"></script>
  <script src="../factory-cost-shared.js"></script>
  <script>
    const COUNTRY_CODE = '${code}';
    const CURRENCY = '${country.currencySymbolEn}';
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
      food: { rawMatPct: 35, elecMult: 1.0, name: 'Food' },
      plastic: { rawMatPct: 50, elecMult: 1.4, name: 'Plastic' },
      metal: { rawMatPct: 42, elecMult: 1.6, name: 'Metal' },
      electronics: { rawMatPct: 32, elecMult: 0.8, name: 'Electronics' },
      textile: { rawMatPct: 36, elecMult: 1.0, name: 'Textile' },
      furniture: { rawMatPct: 30, elecMult: 0.7, name: 'Furniture' },
      pharma: { rawMatPct: 28, elecMult: 0.9, name: 'Pharma' },
      building: { rawMatPct: 38, elecMult: 1.3, name: 'Building Materials' }
    };

    function fmt(n) {
      return Math.round(n).toLocaleString('en-US');
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
      if (!city) { alert('Please select a city first'); return; }
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
        <tr><td><strong>Rent \${city.name}</strong></td><td>\${fmt(rentMonthly)}</td><td>\${fmt(rentMonthly*12)}</td><td>\${pct(rentMonthly)}</td></tr>
        <tr><td>Electricity (\${fmt(electricity)} kWh)</td><td>\${fmt(electricityMonthly)}</td><td>\${fmt(electricityMonthly*12)}</td><td>\${pct(electricityMonthly)}</td></tr>
        <tr><td>Water (\${fmt(water)} m³)</td><td>\${fmt(waterMonthly)}</td><td>\${fmt(waterMonthly*12)}</td><td>\${pct(waterMonthly)}</td></tr>
        <tr><td>Supervision</td><td>\${fmt(supervisionMonthly)}</td><td>\${fmt(supervisionMonthly*12)}</td><td>\${pct(supervisionMonthly)}</td></tr>
        <tr><td>Annual Licenses</td><td>\${fmt(licenseMonthly)}</td><td>\${fmt(licenseMonthly*12)}</td><td>\${pct(licenseMonthly)}</td></tr>
        <tr><td>Labor</td><td>\${fmt(totalLabor)}</td><td>\${fmt(totalLabor*12)}</td><td>\${pct(totalLabor)}</td></tr>
        <tr><td>Maintenance</td><td>\${fmt(maintenanceMonthly)}</td><td>\${fmt(maintenanceMonthly*12)}</td><td>\${pct(maintenanceMonthly)}</td></tr>
        <tr><td>Insurance</td><td>\${fmt(insuranceMonthly)}</td><td>\${fmt(insuranceMonthly*12)}</td><td>\${pct(insuranceMonthly)}</td></tr>
        <tr><td>Raw Materials</td><td>\${fmt(rawMaterialMonthly)}</td><td>\${fmt(rawMaterialMonthly*12)}</td><td>\${pct(rawMaterialMonthly)}</td></tr>
        <tr class="total-row"><td><strong>Total</strong></td><td><strong>\${fmt(totalMonthly)}</strong></td><td><strong>\${fmt(totalYearly)}</strong></td><td>100%</td></tr>
      \`;

      document.getElementById('setupTable').innerHTML = \`
        <tr><td>Plan Approval Fees</td><td>\${fmt(planApproval)} \${CURRENCY}</td><td>One-time</td></tr>
        <tr><td>Rent Deposit (2 months)</td><td>\${fmt(deposit)} \${CURRENCY}</td><td>Based on area</td></tr>
        <tr><td>Electricity Connection</td><td>\${fmt(electricityConnection)} \${CURRENCY}</td><td>Based on usage</td></tr>
        <tr><td>Civil Defense</td><td>\${fmt(civilDefense)} \${CURRENCY}</td><td>Fixed</td></tr>
        <tr><td>Building Permit</td><td>\${fmt(buildingPermit)} \${CURRENCY}</td><td>Based on area</td></tr>
        <tr><td>Basic Insurance</td><td>\${fmt(basicInsurance)} \${CURRENCY}</td><td>Annual upfront</td></tr>
        <tr><td>Miscellaneous</td><td>\${fmt(miscSetup)} \${CURRENCY}</td><td>Estimated</td></tr>
      \`;

      document.getElementById('results').classList.add('show');
    }
  </script>

  <script src="../../shared-utils.js"></script>
  <script src="../../script.js"></script>
</body>
</html>
`;

for (const code of missing) {
  const country = ARAB_COUNTRIES_GEO[code];
  const cities = getFactoryCostCities(code);
  const citiesOptions = Object.keys(cities).map(cityCode => {
    return `            <option value="${cityCode}">${cities[cityCode].name}</option>`;
  }).join('\n');
  const html = template(code, country, citiesOptions);
  const filePath = path.join(__dirname, '..', '..', 'en', 'calculators', `factory-cost-${code.toLowerCase()}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Created ${filePath}`);
}
