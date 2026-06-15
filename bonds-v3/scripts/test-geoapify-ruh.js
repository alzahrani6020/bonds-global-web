const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient({ timeout: 30000 });
async function run() {
  const key = process.env.GEOAPIFY_API_KEY;
  // Larger bbox around Riyadh
  const url = `https://api.geoapify.com/v2/places?categories=healthcare.dentist&filter=rect:46.2,24.3,47.2,25.1&limit=500&apiKey=${key}`;
  const data = await http.get(url);
  console.log('features:', data.features?.length);
}
run().catch(e => console.error(e.message));
