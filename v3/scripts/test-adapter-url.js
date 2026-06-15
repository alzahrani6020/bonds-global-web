const CompetitorDataAdapter = require('../engine/data-acquisition/adapters/CompetitorDataAdapter');
const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const adapter = new CompetitorDataAdapter();
async function run() {
  const geo = await adapter._geocodeCity('Riyadh', 'SA');
  const [south, west, north, east] = geo.bbox;
  const rect = `${west},${south},${east},${north}`;
  const categories = 'healthcare.dentist';
  const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(categories)}&filter=rect:${rect}&limit=500&offset=0&apiKey=${adapter.geoapifyApiKey}`;
  console.log(url);
  const http = new HttpClient();
  const data = await http.get(url, { cacheTtlMs: 7 * 24 * 60 * 60 * 1000 });
  console.log('features:', data.features?.length);
}
run().catch(e => console.error(e));
