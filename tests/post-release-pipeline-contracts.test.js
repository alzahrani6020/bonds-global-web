const fs = require('fs');
const path = require('path');

describe('post-release pipeline contracts', () => {
  test('production smoke uses canonical clean URLs and validates HTML', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/deploy-vercel.yml'),
      'utf8'
    );

    expect(workflow).toContain('"/calculators/investment-center"');
    expect(workflow).toContain('"/en/calculators/investment-center"');
    expect(workflow).not.toContain('/calculators/investment-center/index.html');
    expect(workflow).not.toContain('/en/calculators/investment-center/index.html');
    expect(workflow).toContain('grep -F "<!DOCTYPE html>"');
  });

  test('production promotion refuses stale main SHAs', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/deploy-vercel.yml'),
      'utf8'
    );

    expect(workflow).toContain('Verify release candidate is current main');
    expect(workflow).toContain('git fetch origin main --depth=1');
    expect(workflow).toContain('Refusing to promote stale release candidate.');
  });

  test('existing forward migrations are immutable after merge', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '../.github/workflows/apply-migrations.yml'),
      'utf8'
    );

    expect(workflow).toContain('--diff-filter=MD');
    expect(workflow).toContain('Existing forward migration files are immutable once merged.');
    expect(workflow).toContain('Create a new recovery migration instead of modifying or deleting:');
  });
});
