/**
 * Demo script for the Data Acquisition & Fusion Platform.
 * Runs without database — shows how adapters, fusion, and inference work.
 */
const {
  FusionCore,
  InferenceEngine,
  adapters: { GastatAdapter, SamaAdapter, ManualAdapter, LLMEstimationAdapter }
} = require('../engine/data-acquisition');

async function main() {
  console.log('=== Bonds V3 — Data Acquisition Demo ===\n');

  // 1. Fusion Core
  const fusion = new FusionCore();
  const fused = fusion.fuse([
    { value: 7500000, sourceId: 'gastat', confidence: 95, fetchedAt: new Date() },
    { value: 7600000, sourceId: 'manual', confidence: 85, fetchedAt: new Date() }
  ], 'number');
  console.log('Fused population:', fused);

  // 2. Inference Engine
  const inferenceEngine = new InferenceEngine();
  console.log('\nInferred GDP for RUH:', inferenceEngine.infer('gdp_city', {
    cityCode: 'RUH',
    availableMetrics: { population: { value: 7500000 } }
  }));
  console.log('Inferred rent for restaurant in RUH:', inferenceEngine.infer('avg_rent_per_sqm', {
    cityCode: 'RUH',
    activityCode: 'restaurant'
  }));
  console.log('Inferred market size for restaurant in JED:', inferenceEngine.infer('market_size', {
    cityCode: 'JED',
    activityCode: 'restaurant',
    availableMetrics: { population: { value: 4800000 }, household_income: { value: 165000 } }
  }));

  // 3. Adapters
  const gastat = new GastatAdapter();
  const gastatRaw = await gastat.fetch({ cityCode: 'RUH', year: 2025 });
  const gastatMetrics = await gastat.transform(gastatRaw[0]);
  console.log('\nGASTAT metrics for RUH:', gastatMetrics);

  const sama = new SamaAdapter();
  const samaRaw = await sama.fetch({ cityCode: 'RUH', year: 2025 });
  const samaMetrics = await sama.transform(samaRaw[0]);
  console.log('SAMA metrics for RUH:', samaMetrics);

  // 4. Manual adapter
  const manual = new ManualAdapter();
  const manualRaw = await manual.fetch({
    manualData: [{
      metricCode: 'avg_rent_per_sqm',
      value: 1500,
      year: 2025,
      cityId: 'xxx',
      confidenceReason: 'Verified by field research'
    }]
  });
  const manualMetrics = await manual.transform(manualRaw[0]);
  console.log('\nManual metric:', manualMetrics);

  // 5. LLM / Inference adapter
  const llm = new LLMEstimationAdapter({ inferenceEngine });
  const llmRaw = await llm.fetch({ cityCode: 'JED', activityCode: 'restaurant', year: 2025, metricCodes: ['market_size', 'competitors_count'] });
  console.log('\nLLM/Inference estimates for JED restaurant:', llmRaw);

  console.log('\n=== Demo complete ===');
}

main().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
