/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dirs = [
  path.join(ROOT, 'calculators', 'investment-center'),
  path.join(ROOT, 'en', 'calculators', 'investment-center')
];

function calculatorFiles() {
  return dirs.flatMap(dir => fs.readdirSync(dir)
    .filter(name => name.endsWith('.html') && name !== 'index.html')
    .map(name => path.join(dir, name)));
}

describe('investment-center expert investment semantics', () => {
  const generator = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-investment-calculators.js'), 'utf8');

  test('generator does not replace base investment from supplemental-only expert fields', () => {
    expect(generator).toContain('const expertCoreInvestmentTotal = inputs.landCost + inputs.buildingCost + inputs.renovationCost + inputs.machineryCost + inputs.furnitureCost + inputs.vehiclesCost;');
    expect(generator).toContain('if (expertCoreInvestmentTotal > 0) {');
    expect(generator).toContain('totalInvestment = expertCoreInvestmentTotal + expertSupplementalInvestmentTotal;');
    expect(generator).not.toContain('if (expertInvestmentTotal > 0) {');
  });

  test('all generated AR/EN calculators carry the guarded replacement semantics', () => {
    const files = calculatorFiles();
    expect(files.length).toBe(126);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toContain('if (expertCoreInvestmentTotal > 0) {');
      expect(source).toContain('totalInvestment = expertCoreInvestmentTotal + expertSupplementalInvestmentTotal;');
      expect(source).not.toContain('if (expertInvestmentTotal > 0) {');
    }
  });
});
