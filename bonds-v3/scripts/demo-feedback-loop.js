/**
 * Demo script for the Feedback Loop.
 * Submits sample feedback and shows how inference improves.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { FeedbackEngine, InferenceEngine } = require('../engine/data-acquisition');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
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
  const config = {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };

  const supabase = createClient(config.url, config.serviceRoleKey);
  const feedback = new FeedbackEngine(config);
  const inference = new InferenceEngine();

  // Get RUH city ID
  const { data: city } = await supabase.from('cities').select('id, code').eq('code', 'RUH').single();

  console.log('=== Before Feedback ===');
  const before = inference.infer('avg_rent_per_sqm', { cityCode: 'RUH', activityCode: 'restaurant' });
  console.log('Estimated rent:', before.value, 'confidence:', before.confidence + '%');

  // Submit feedback: actual rent is much higher than estimate
  console.log('\n=== Submitting Feedback ===');
  for (let i = 0; i < 3; i++) {
    await feedback.submitFeedback({
      metricCode: 'avg_rent_per_sqm',
      cityId: city.id,
      year: 2025,
      estimatedValue: before.value,
      actualValue: 2500,
      source: 'admin',
      confidence: 90,
      notes: 'Field research in RUH commercial areas'
    });
    console.log(`Feedback ${i + 1} submitted`);
  }

  console.log('\n=== After Feedback ===');
  const correction = await feedback.getCorrectionFactor('avg_rent_per_sqm', { cityId: city.id, year: 2025 });
  console.log('Correction factor:', correction.factor.toFixed(2), 'based on', correction.feedbackCount, 'feedbacks');

  const after = inference.infer('avg_rent_per_sqm', { cityCode: 'RUH', activityCode: 'restaurant' }, {
    avg_rent_per_sqm: correction
  });
  console.log('Adjusted estimated rent:', after.value, 'confidence:', after.confidence + '%');

  console.log('\n=== Accuracy Summary ===');
  const summary = await feedback.getAccuracySummary({ metricCode: 'avg_rent_per_sqm', cityId: city.id });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
