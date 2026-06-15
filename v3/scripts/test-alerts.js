/**
 * Test script for AlertEngine.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const AlertEngine = require('../engine/AlertEngine');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const engine = new AlertEngine(supabase);

  const { data: city } = await supabase.from('cities').select('id').eq('code', 'RUH').single();
  if (!city) throw new Error('City RUH not found');

  // Create a test rule
  const { data: rule, error } = await supabase
    .from('alert_rules')
    .insert({
      name: 'Test rent increase',
      metric_code: 'avg_rent_per_sqm',
      entity_type: 'city',
      city_id: city.id,
      threshold_type: 'relative',
      threshold_value: 0.01,
      severity: 'warning'
    })
    .select()
    .single();

  if (error) throw error;
  console.log('Created rule:', rule.id);

  const alerts = await engine.evaluateAll({ cityIds: [city.id] });
  console.log('Generated alerts:', alerts.length);
  for (const a of alerts) {
    console.log(`- ${a.metric_code}: ${a.old_value} -> ${a.new_value} (${a.change_percent}%)`);
  }

  // Clean up
  await supabase.from('alerts').delete().eq('rule_id', rule.id);
  await supabase.from('alert_rules').delete().eq('id', rule.id);
  console.log('Cleaned up');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
