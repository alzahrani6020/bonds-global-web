/**
 * Live end-to-end test for /api/v3/ai/analyze
 *
 * Usage:
 *   AI_TEST_JWT=<supabase_user_jwt> node scripts/test-ai-analyze-live.js
 *
 * Optional:
 *   AI_TEST_ENDPOINT=https://bonds-global.com/api/v3/ai/analyze
 */

const endpoint = process.env.AI_TEST_ENDPOINT || 'https://bonds-global.com/api/v3/ai/analyze';
const token = process.env.AI_TEST_JWT;

if (!token) {
  console.error(" Missing AI_TEST_JWT environment variable.");
  console.error('   Provide a valid Supabase user JWT to test the endpoint.');
  process.exit(1);
}

const payload = {
  type: 'feasibility_study',
  data: {
    project_name: 'E2E Test Project',
    sector: 'manufacturing',
    city: 'Riyadh',
    country: 'SA',
    initial_investment: 500000,
    projected_revenue: 1200000,
    projected_costs: 900000,
    currency: 'SAR'
  }
};

async function run() {
  console.log(`POST ${endpoint}`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    console.log('Body:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Request failed:', err.message);
    process.exit(1);
  }
}

run();
