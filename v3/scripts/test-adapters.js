const GastatAdapter = require('../engine/data-acquisition/adapters/GastatAdapter');
const SamaAdapter = require('../engine/data-acquisition/adapters/SamaAdapter');

async function test() {
  for (const year of [2020, 2023, 2025]) {
    console.log(`\n=== Year ${year} ===`);
    const gastat = new GastatAdapter();
    const gastatData = await gastat.fetch({ cityCode: 'RUH', year });
    console.log('GASTAT:', JSON.stringify(gastatData[0].metrics), '| quality:', gastatData[0].quality);

    const sama = new SamaAdapter();
    const samaData = await sama.fetch({ cityCode: 'RUH', year });
    console.log('SAMA:', JSON.stringify(samaData[0].metrics), '| quality:', samaData[0].quality);
  }
}

test().catch(console.error);
