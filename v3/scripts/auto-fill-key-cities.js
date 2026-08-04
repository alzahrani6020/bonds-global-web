/**
 * Bonds V3 — Auto-fill market data for key cities using the Data Engine.
 *
 * This replaces coarse country-average estimates with Data Engine outputs
 * for the most important cities in each supported country.
 */

const { Client } = require('pg');
const {
  CityEngine,
  RealEstateEngine,
  LaborEngine,
  CompetitionEngine,
  MarketEngine,
  PricingEngine
} = require('../engine/data-acquisition/engines');

const KEY_CITIES = [
  // Saudi Arabia
  { code: 'SA-01-001', country: 'SA' }, // Riyadh
  { code: 'SA-02-001', country: 'SA' }, // Makkah
  { code: 'SA-02-002', country: 'SA' }, // Jeddah
  { code: 'SA-03-001', country: 'SA' }, // Madinah
  { code: 'SA-05-001', country: 'SA' }, // Dammam
  { code: 'SA-05-002', country: 'SA' }, // Khobar
  { code: 'SA-06-001', country: 'SA' }, // Abha
  { code: 'SA-07-001', country: 'SA' }, // Tabuk
  { code: 'SA-08-001', country: 'SA' }, // Hail
  { code: 'SA-04-001', country: 'SA' }, // Buraidah
  // UAE
  { code: 'AE-01-001', country: 'AE' }, // Dubai
  { code: 'AE-02-001', country: 'AE' }, // Abu Dhabi
  // Egypt
  { code: 'EG-01-001', country: 'EG' }, // Cairo
  { code: 'EG-02-001', country: 'EG' }, // Alexandria
  // Jordan
  { code: 'JO-01-001', country: 'JO' }, // Amman
  // Qatar
  { code: 'QA-01-001', country: 'QA' }, // Doha
  // Kuwait
  { code: 'KW-01-001', country: 'KW' }, // Kuwait City
  // Bahrain
  { code: 'BH-01-001', country: 'BH' }, // Manama
  // Oman
  { code: 'OM-01-001', country: 'OM' }, // Muscat
  // Iraq
  { code: 'IQ-01-001', country: 'IQ' }, // Baghdad
  // Lebanon
  { code: 'LB-01-001', country: 'LB' }, // Beirut
  // Syria
  { code: 'SY-01-001', country: 'SY' }, // Damascus
  // Palestine
  { code: 'PS-01-001', country: 'PS' }, // Jerusalem
  // Tunisia
  { code: 'TN-01-001', country: 'TN' }, // Tunis
  // Algeria
  { code: 'DZ-01-001', country: 'DZ' }, // Algiers
  // Morocco
  { code: 'MA-01-001', country: 'MA' }, // Rabat
  // Libya
  { code: 'LY-01-001', country: 'LY' }, // Tripoli
  // Sudan
  { code: 'SD-01-001', country: 'SD' }, // Khartoum
  // Yemen
  { code: 'YE-01-001', country: 'YE' }, // Sanaa
  // Somalia
  { code: 'SO-01-001', country: 'SO' }, // Mogadishu
  // Djibouti
  { code: 'DJ-01-001', country: 'DJ' }, // Djibouti
  // Mauritania
  { code: 'MR-01-001', country: 'MR' }, // Nouakchott
  // Comoros
  { code: 'KM-01-001', country: 'KM' }  // Moroni
];

const ACTIVITY_CODES = [
  'restaurant', 'cafe', 'supermarket', 'pharmacy', 'gym', 'beauty',
  'mobile_shop', 'clothing_shop', 'hotel_boutique', 'kindergarten', 'short_delivery'
];

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(" Please set SUPABASE_DB_URL or DATABASE_URL");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const config = {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  const year = new Date().getFullYear();
  let cityCount = 0;
  let activityCount = 0;

  try {
    for (const cityInfo of KEY_CITIES) {
      const { rows: cityRows } = await client.query(
        'SELECT id, code, country_code FROM public.cities WHERE code = $1',
        [cityInfo.code]
      );
      if (cityRows.length === 0) {
        console.warn(` City not found: ${cityInfo.code}`);
        continue;
      }
      const city = cityRows[0];
      console.log(`\n ${cityInfo.code} (${city.country_code})`);

      // Run city engine for indicators
      try {
        const cityEngine = new CityEngine(config);
        const cityResult = await cityEngine.run({
          cityId: city.id,
          cityCode: city.code,
          countryCode: city.country_code,
          year
        });
        console.log(`   CityEngine: ${cityResult.adapters.map(a => a.sourceId + ':' + a.status).join(', ')}`);
        cityCount++;
      } catch (err) {
        console.error(`   CityEngine failed: ${err.message}`);
      }

      // Run activity engines
      for (const activityCode of ACTIVITY_CODES) {
        const { rows: actRows } = await client.query(
          'SELECT id FROM public.economic_activities WHERE code = $1',
          [activityCode]
        );
        if (actRows.length === 0) continue;
        const activityId = actRows[0].id;

        try {
          const engines = [
            new RealEstateEngine(config),
            new LaborEngine(config),
            new CompetitionEngine(config),
            new MarketEngine(config),
            new PricingEngine(config)
          ];
          for (const engine of engines) {
            await engine.run({
              cityId: city.id,
              cityCode: city.code,
              activityId,
              activityCode,
              year
            });
          }
          activityCount++;
          process.stdout.write('.');
        } catch (err) {
          console.error(`\n   ${activityCode} failed: ${err.message}`);
        }
      }
    }

    console.log(`\n\n Done. Processed ${cityCount} cities and ${activityCount} city/activity combinations.`);
  } catch (err) {
    console.error(" Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
