const CompetitorDataAdapter = require('../engine/data-acquisition/adapters/CompetitorDataAdapter');
const adapter = new CompetitorDataAdapter();
async function run() {
  console.log('geoapify key?', !!adapter.geoapifyApiKey);
  const geo = await adapter._geocodeCity('Riyadh', 'SA');
  console.log('geo', geo);
  try {
    const count = await adapter._countGeoapify(geo.bbox, 'dental_clinics');
    console.log('count dental', count);
  } catch (err) { console.error('count error', err); }
}
run();
