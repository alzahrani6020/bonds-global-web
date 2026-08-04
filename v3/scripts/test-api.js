/**
 * Tests Bonds V3 API endpoints.
 *
 * Usage:
 *   node scripts/test-api.js [baseUrl]
 *
 * Example:
 *   node scripts/test-api.js https://bonds-v3.vercel.app
 *   node scripts/test-api.js http://localhost:3001
 */

const baseUrl = (process.argv[2] || 'https://bonds-v3.vercel.app').replace(/\/$/, '');

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

function log(name, status, ok) {
  console.log(`${ok ? "" : ""} ${name}: ${status}`);
}

async function runTests() {
  console.log(`Testing Bonds V3 API at ${baseUrl}\n`);

  // Health
  const health = await request('/api/health');
  log('Health', health.status, health.status === 200 && health.data.status === 'ok');

  // Sectors
  const sectors = await request('/api/sectors');
  log('Sectors', sectors.status, sectors.status === 200 && Array.isArray(sectors.data.sectors));
  if (sectors.status === 200) {
    console.log(`   Found ${sectors.data.sectors?.length || 0} sectors`);
  }

  // Models
  const models = await request('/api/models');
  log('Models', models.status, models.status === 200 && Array.isArray(models.data.models));
  if (models.status === 200) {
    console.log(`   Found ${models.data.count || 0} models`);
  }

  // Models by sector
  const foodModels = await request('/api/models?sector=food_services');
  log('Models by sector', foodModels.status, foodModels.status === 200);
  if (foodModels.status === 200) {
    console.log(`   Found ${foodModels.data.count || 0} food service models`);
  }

  // Calculate
  const calc = await request('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectModelCode: 'burger_restaurant_small',
      cityCode: 'RUH',
      assumptions: { revenue: 600000, capex: 450000 },
      projectionYears: 5
    })
  });
  log('Calculate', calc.status, calc.status === 200 && calc.data.summary);
  if (calc.status === 200) {
    console.log(`   NPV: ${calc.data.summary.npv}, IRR: ${calc.data.summary.irr}%, Risk: ${calc.data.risk.score}`);
    console.log(`   AI Verdict: ${calc.data.ai?.verdictLabel}`);
  } else if (calc.data?.error) {
    console.log(`   Error: ${calc.data.error}`);
  }

  console.log('\nDone.');
}

runTests().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
