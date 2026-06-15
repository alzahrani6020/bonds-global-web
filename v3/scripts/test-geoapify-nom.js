const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient();
async function run() {
  const key = process.env.GEOAPIFY_API_KEY;
  const rect = '46.5560104,24.4789160,46.8760104,24.7989160';
  const url = `https://api.geoapify.com/v2/places?categories=healthcare.dentist&filter=rect:${rect}&limit=500&apiKey=${key}`;
  const data = await http.get(url);
  console.log('features:', data.features?.length);
}
run().catch(e => console.error(e));
