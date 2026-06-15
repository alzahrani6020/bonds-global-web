const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient();
async function run() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  console.log('key present?', !!key);
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=24.7136,46.6753&radius=40000&type=dentist&key=${key}`;
  const data = await http.get(url);
  console.log('status:', data.status);
  console.log('results count:', data.results?.length);
  console.log('error:', data.error_message);
}
run().catch(console.error);
