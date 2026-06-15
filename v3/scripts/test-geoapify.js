const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient();
async function run() {
  const key = process.env.GEOAPIFY_API_KEY;
  console.log('key present?', !!key);
  const url = `https://api.geoapify.com/v2/places?categories=healthcare.dentist&filter=rect:46.4,24.5,46.9,24.9&limit=500&apiKey=${key}`;
  const data = await http.get(url);
  console.log('features:', data.features?.length);
  console.log('error:', data.error?.message || data.message);
}
run().catch(console.error);
