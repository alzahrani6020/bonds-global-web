const { HttpClient } = require('../engine/data-acquisition/HttpClient');
const http = new HttpClient({ timeout: 30000 });
async function test(cat) {
  const key = process.env.GEOAPIFY_API_KEY;
  const url = `https://api.geoapify.com/v2/places?categories=${cat}&filter=rect:46.2,24.3,47.2,25.1&limit=500&apiKey=${key}`;
  const data = await http.get(url);
  console.log(cat, data.features?.length);
}
(async () => {
  await test('healthcare.dentist');
  await test('healthcare');
  await test('commercial');
})();
