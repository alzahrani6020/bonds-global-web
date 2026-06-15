/**
 * اختبار سريع لمحول OpenStreetMap بدون Supabase.
 */
const CompetitorDataAdapter = require('../engine/data-acquisition/adapters/CompetitorDataAdapter');

const adapter = new CompetitorDataAdapter();

const tests = [
  { cityCode: 'RUH', cityName: 'Riyadh', countryCode: 'SA', population: 7600000, activityCode: 'dental_clinics' },
  { cityCode: 'JED', cityName: 'Jeddah', countryCode: 'SA', population: 4800000, activityCode: 'dental_clinics' },
  { cityCode: 'CAI', cityName: 'Cairo', countryCode: 'EG', population: 10000000, activityCode: 'dental_clinics' },
  { cityCode: 'DXB', cityName: 'Dubai', countryCode: 'AE', population: 3500000, activityCode: 'dental_clinics' },
  { cityCode: 'RUH', cityName: 'Riyadh', countryCode: 'SA', population: 7600000, activityCode: 'restaurant' }
];

async function run() {
  for (const t of tests) {
    const start = Date.now();
    try {
      const items = await adapter.fetch(t);
      const countItem = items.find(i => i.metricCode === 'competitors_count');
      console.log(
        `${t.cityCode} | ${t.activityCode.padEnd(16)} | count=${String(countItem?.value ?? '-').padStart(6)} | method=${countItem?.sourceMethod || '-'} | time=${Date.now() - start}ms`
      );
    } catch (err) {
      console.error(`${t.cityCode} | ${t.activityCode} | ERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run().catch(console.error);
