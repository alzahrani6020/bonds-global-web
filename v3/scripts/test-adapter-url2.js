const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient();
async function run() {
  const key = process.env.GEOAPIFY_API_KEY;
  const url = `https://api.geoapify.com/v2/places?categories=healthcare.dentist&filter=rect:46.5560104,24.4789160,46.8760104,24.7989160&limit=500&offset=0&apiKey=${key}`;
  console.log('without cache');
  const data = await http.get(url);
  console.log('features:', data.features?.length);
}
run().catch(e => console.error(e));
