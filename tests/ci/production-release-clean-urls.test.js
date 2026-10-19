const fs = require('fs');
const path = require('path');

describe('Production release clean URL smoke contract', () => {
  test('staged tools smoke requests canonical clean URLs', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../../.github/workflows/deploy-vercel.yml'),
      'utf8'
    );

    const canonicalPaths = [
      '/calculators/investment-center',
      '/en/calculators/investment-center',
      '/calculators/cash-flow',
      '/en/calculators/cash-flow',
      '/calculator-wizard',
      '/en/calculator-wizard',
      '/calculators/medical-viability',
      '/en/calculators/medical-viability'
    ];

    for (const route of canonicalPaths) {
      expect(workflow).toContain(`"$deployment_url${route}"`);
    }

    expect(workflow).not.toContain('/calculators/investment-center/index.html');
    expect(workflow).not.toContain('/en/calculators/investment-center/index.html');
  });
});
