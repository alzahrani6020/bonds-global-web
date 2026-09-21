/**
 * Security hardening test script.
 * Tests that anon key cannot access hardened tables/views/functions,
 * while service role still can.
 */
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
const serviceClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const criticalTables = [
  'bonds_objects',
  'bonds_sequences',
  'business_rules_registry',
  'formula_registry',
  'data_sources',
];

const otherHardenedTables = [
  '_migrations',
  'activity_market_profiles',
  'confidence_log',
  'data_feedback',
  'fabric_api_contracts',
  'fabric_conflicts',
  'fabric_connector_definitions',
  'fabric_consensus',
  'fabric_data_quality',
  'fabric_decision_impacts',
  'fabric_marketplace_items',
  'fabric_observability_events',
  'fabric_plugins',
  'fabric_provenance',
  'fabric_refresh_policies',
  'fabric_source_rankings',
  'official_country_data',
  'social_accounts',
  'social_posts',
  'social_scheduled_posts',
];

const hardenedViews = [
  'assets_due_for_reassessment',
  'high_risk_assets',
  'metric_feedback_accuracy',
];

const adminFunctions = [
  { name: 'grant_all_permissions', args: { p_role_name: 'test_role' } },
  { name: 'clear_data_quality_issues', args: { p_check_type: 'test' } },
  { name: 'dq_run_all_checks', args: {} },
];

const publicFunctions = [
  { name: 'capture_lead', args: { p_name: 'Test', p_email: 'test@example.com' } },
  { name: 'global_search', args: { p_query: 'test' } },
];

async function testSelect(client, label, table) {
  const { data, error } = await client.from(table).select('*').limit(1);
  return { label, table, op: 'SELECT', allowed: !error, error: error ? error.message : null };
}

async function testInsert(client, label, table) {
  // Use a dummy row; if somehow allowed, service role cleanup will remove it.
  let payload = { id: '00000000-0000-0000-0000-000000000001' };
  if (table === 'bonds_objects') {
    payload = { prefix: 'TEST', human_id: 'TEST-00000001', entity_type: 'test', metadata: {} };
  } else if (table === 'bonds_sequences') {
    payload = { prefix: 'TEST', year: 2099, last_number: 1 };
  } else if (table === 'business_rules_registry') {
    payload = { code: 'TEST', condition_text: 'test', action_text: 'test', priority: 'low', engine: 'test', category: 'test', status: 'draft', metadata: {}, approval_status: 'draft' };
  } else if (table === 'formula_registry') {
    payload = { code: 'TEST', name: 'test', expression: '1+1', variables: {}, category: 'test', engine: 'test', version: 1, status: 'draft', metadata: {}, approval_status: 'draft' };
  } else if (table === 'data_sources') {
    payload = { source_code: 'TEST', name: 'test', category: 'test', confidence_default: 'low', schema: {}, enabled: false };
  }
  const { data, error } = await client.from(table).insert(payload).select();
  return { label, table, op: 'INSERT', allowed: !error, error: error ? error.message : null, insertedId: data && data[0] ? (data[0].id || null) : null };
}

async function testRpc(client, label, fn) {
  const { data, error } = await client.rpc(fn.name, fn.args);
  return { label, function: fn.name, allowed: !error, error: error ? error.message : null };
}

async function cleanupTestRows() {
  // Remove any test rows that may have been inserted if permissions were incorrectly allowed.
  for (const table of criticalTables) {
    try {
      let column = 'id';
      let value = '00000000-0000-0000-0000-000000000001';
      if (table === 'bonds_objects') value = 'TEST-00000001';
      if (table === 'bonds_sequences') { column = 'prefix'; value = 'TEST'; }
      if (table === 'business_rules_registry') { column = 'code'; value = 'TEST'; }
      if (table === 'formula_registry') { column = 'code'; value = 'TEST'; }
      if (table === 'data_sources') { column = 'source_code'; value = 'TEST'; }
      await serviceClient.from(table).delete().eq(column, value);
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

async function runTests() {
  await cleanupTestRows();

  const results = [];

  // 1. Anon SELECT on critical tables
  for (const table of criticalTables) {
    results.push(await testSelect(anonClient, 'anon', table));
  }

  // 2. Anon SELECT on other hardened tables
  for (const table of otherHardenedTables) {
    results.push(await testSelect(anonClient, 'anon', table));
  }

  // 3. Anon SELECT on hardened views
  for (const view of hardenedViews) {
    results.push(await testSelect(anonClient, 'anon', view));
  }

  // 4. Anon INSERT on critical tables
  for (const table of criticalTables) {
    results.push(await testInsert(anonClient, 'anon', table));
  }

  // 5. Service role SELECT on critical tables
  for (const table of criticalTables) {
    results.push(await testSelect(serviceClient, 'service_role', table));
  }

  // 6. Service role SELECT on hardened views
  for (const view of hardenedViews) {
    results.push(await testSelect(serviceClient, 'service_role', view));
  }

  // 7. Admin functions from anon
  for (const fn of adminFunctions) {
    results.push(await testRpc(anonClient, 'anon', fn));
  }

  // 8. Public functions from anon (should still work)
  for (const fn of publicFunctions) {
    results.push(await testRpc(anonClient, 'anon', fn));
  }

  await cleanupTestRows();

  // Print results
  const failed = results.filter(r => {
    if (r.label === 'anon' && (r.op === 'SELECT' || r.op === 'INSERT')) return r.allowed;
    if (r.label === 'anon' && adminFunctions.some(f => f.name === r.function)) return r.allowed;
    if (r.label === 'service_role' && r.op === 'SELECT') return !r.allowed;
    if (r.label === 'anon' && publicFunctions.some(f => f.name === r.function)) return !r.allowed;
    return false;
  });

  console.log(JSON.stringify({
    total: results.length,
    failed: failed.length,
    failedDetails: failed,
    allResults: results,
  }, null, 2));

  process.exit(failed.length > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test script error:', e.message);
  process.exit(1);
});
