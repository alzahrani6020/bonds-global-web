/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../../lib/enterprise/rules-engine.js'), 'utf8');
const ctx = {};
const fn = new Function('window', code);
fn(ctx);
const R = ctx.BondsRules;

describe('BondsRules Engine', () => {
  test('registers and evaluates custom rule', () => {
    R.register('budgetOk', ctx => ctx.budget > 1000, { message: 'Budget too low' });
    expect(R.evaluate('budgetOk', { budget: 2000 }).passed).toBe(true);
    expect(R.evaluate('budgetOk', { budget: 100 }).passed).toBe(false);
    R.unregister('budgetOk');
  });

  test('evaluates multiple rules', () => {
    R.register('r1', ctx => ctx.a > 0, { message: 'a must be positive' });
    R.register('r2', ctx => ctx.b > 0, { message: 'b must be positive' });
    const res = R.evaluateAll(['r1', 'r2'], { a: 1, b: 0 });
    expect(res.passed).toBe(false);
    expect(res.failures.length).toBe(1);
    R.unregister('r1');
    R.unregister('r2');
  });

  test('built-in advisory_project workflow allows valid transition', () => {
    const res = R.canTransition('advisory_project', 'draft', 'lead', { clientId: 'x' });
    expect(res.allowed).toBe(true);
  });

  test('built-in workflow blocks invalid jump', () => {
    const res = R.canTransition('advisory_project', 'draft', 'completed', {});
    expect(res.allowed).toBe(false);
  });

  test('workflow enforces required rules', () => {
    const res = R.canTransition('advisory_project', 'proposal', 'active', { budget: 0 });
    expect(res.allowed).toBe(false);
  });

  test('workflow approval required', () => {
    const res = R.canTransition('recovery_asset', 'planning', 'write_off', {});
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('Approval');
  });
});
