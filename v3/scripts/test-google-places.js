const CompetitorDataAdapter = require('../engine/data-acquisition/adapters/CompetitorDataAdapter');
const adapter = new CompetitorDataAdapter();
async function run() {
  const items = await adapter.fetch({
    cityCode: 'RUH',
    cityName: 'Riyadh',
    countryCode: 'SA',
    population: 7600000,
    activityCode: 'dental_clinics'
  });
  console.log(JSON.stringify(items, null, 2));
}
run().catch(console.error);
