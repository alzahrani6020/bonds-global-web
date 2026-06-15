const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient();
async function run() {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=Riyadh%2C%20SA&limit=1&countrycodes=SA';
  const data = await http.get(url, { headers: { 'User-Agent': 'BondsV3-DataBot/1.0' }, cacheTtlMs: 30*24*60*60*1000 });
  console.log(data?.[0]);
}
run().catch(e => console.error(e.message));
