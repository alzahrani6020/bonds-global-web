const CompetitorDataAdapter = require('../engine/data-acquisition/adapters/CompetitorDataAdapter');
const adapter = new CompetitorDataAdapter();
async function run() {
  try {
    const items = await adapter.fetch({
      cityCode: 'RUH', cityName: 'Riyadh', countryCode: 'SA',
      population: 7600000, activityCode: 'dental_clinics'
    });
    console.log('dental:', JSON.stringify(items));
  } catch (err) { console.error('dental error:', err.message); }
  await new Promise(r => setTimeout(r, 1000));
  try {
    const items = await adapter.fetch({
      cityCode: 'RUH', cityName: 'Riyadh', countryCode: 'SA',
      population: 7600000, activityCode: 'restaurant'
    });
    console.log('restaurant:', JSON.stringify(items));
  } catch (err) { console.error('restaurant error:', err.message); }
}
run();
