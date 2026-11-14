/**
 * @jest-environment node
 *
 * Hardening regression tests for the Universal Calculation Platform (PR-B):
 * 1. POST /ucp/calculate requires an authenticated user (401 for anonymous).
 * 2. weightScore must receive raw numbers, not { code, value, unit } entries.
 * 3. Scenario count is capped by UCP_MAX_SCENARIOS (default 5).
 * 4. Swallowed formula node errors surface in run.errors and downgrade the
 *    run status to success_with_errors (also persisted by storeRun).
 */

jest.mock('../../v3/lib/auth', () => ({ getUserFromToken: jest.fn() }));
jest.mock('../../v3/lib/supabase', () => ({ getSupabaseClient: jest.fn(() => ({})) }));
jest.mock('../../lib/api/rate-limit', () => ({ checkRateLimit: jest.fn(async () => false) }));
jest.mock('../../lib/ucp', () => ({ UniversalCalculationPlatform: { create: jest.fn() } }));

const { getUserFromToken } = require('../../v3/lib/auth');
const { UniversalCalculationPlatform } = require('../../lib/ucp');
const { UniversalCalculationPlatform: RealUCP } = jest.requireActual('../../lib/ucp');
const { WeightRegistry } = require('../../lib/ucp/weight-registry');
const handler = require('../../v3/api/index');

function mockReq({ body, headers = {} }) {
  return {
    method: 'POST',
    url: '/ucp/calculate',
    headers: { host: 'localhost', ...headers },
    on(event, cb) {
      if (event === 'data' && body) cb(JSON.stringify(body));
      if (event === 'end') cb();
    }
  };
}

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(data) { this.data = data ? JSON.parse(data) : null; }
  };
}

describe('POST /ucp/calculate authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects anonymous callers with 401 before running UCP', async () => {
    getUserFromToken.mockResolvedValue(null);
    const res = mockRes();
    await handler(mockReq({ body: { sector: 'restaurant', inputs: { revenue: 1 } } }), res);
    expect(res.statusCode).toBe(401);
    expect(res.data.error).toBe('Unauthorized');
    expect(UniversalCalculationPlatform.create).not.toHaveBeenCalled();
  });

  test('runs calculation for authenticated user and attributes the run to them', async () => {
    getUserFromToken.mockResolvedValue({ id: 'user-1' });
    const calculate = jest.fn().mockResolvedValue({ status: 'success', errors: [], outputs: {} });
    UniversalCalculationPlatform.create.mockResolvedValue({ calculate });
    const res = mockRes();
    await handler(
      mockReq({ body: { sector: 'restaurant', inputs: { revenue: 100 } }, headers: { authorization: 'Bearer token' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(calculate.mock.calls[0][0].userId).toBe('user-1');
  });
});

describe('UCP engine hardening', () => {
  let ucp;
  beforeEach(async () => {
    ucp = await RealUCP.create({ preferStatic: true });
    ucp.options.persistRuns = false;
  });

  test('weightScore uses computed output values instead of always scoring 0', async () => {
    const result = await ucp.calculate({
      sector: 'restaurant',
      weightCode: 'wgt_investment',
      inputs: {
        revenue: 100000,
        cogs: 35000,
        operating_expenses: 25000,
        fixed_costs: 20000,
        variable_cost_per_unit: 15,
        unit_price: 50,
        transaction_count: 2000,
        loan_amount: 100000,
        asset_value: 500000
      }
    });
    // net_profit_margin = 40 and wgt_investment assigns it weight 0.25 of total weight 1.
    expect(result.scenarios[0].weightScore).not.toBeNull();
    expect(result.scenarios[0].weightScore.weightedSum).toBeCloseTo(40 * 0.25);
    expect(result.scenarios[0].weightScore.score).toBeCloseTo(40 * 0.25);
  });

  test('WeightRegistry.score unwraps { value } entries defensively', () => {
    const registry = new WeightRegistry({ preferStatic: true });
    const fromObjects = registry.score('wgt_financing', {
      dscr: { code: 'dscr', value: 1.5, unit: 'ratio' },
      ltv: { code: 'ltv', value: 60, unit: 'percent' },
      roi: { code: 'roi', value: 20, unit: 'percent' },
      payback_period: { code: 'payback_period', value: 3, unit: 'year' }
    });
    const fromNumbers = registry.score('wgt_financing', { dscr: 1.5, ltv: 60, roi: 20, payback_period: 3 });
    expect(fromObjects.score).toBeCloseTo(fromNumbers.score);
    expect(fromObjects.score).toBeGreaterThan(0);
  });

  test('rejects more scenarios than UCP_MAX_SCENARIOS (default 5)', async () => {
    const codes = Array.from({ length: 6 }, () => 'scn_expected');
    await expect(
      ucp.calculate({ sector: 'restaurant', inputs: { revenue: 1, cogs: 1, operating_expenses: 1 }, scenarioCodes: codes })
    ).rejects.toThrow('Too many scenarios requested: 6 (max 5)');
  });

  test('allows up to the cap and honors the UCP_MAX_SCENARIOS override', async () => {
    const five = Array.from({ length: 5 }, () => 'scn_expected');
    const result = await ucp.calculate({
      sector: 'restaurant',
      inputs: { revenue: 1, cogs: 1, operating_expenses: 1 },
      scenarioCodes: five
    });
    expect(result.scenarios.length).toBe(5);

    process.env.UCP_MAX_SCENARIOS = '6';
    try {
      const six = Array.from({ length: 6 }, () => 'scn_expected');
      const raised = await ucp.calculate({
        sector: 'restaurant',
        inputs: { revenue: 1, cogs: 1, operating_expenses: 1 },
        scenarioCodes: six
      });
      expect(raised.scenarios.length).toBe(6);
    } finally {
      delete process.env.UCP_MAX_SCENARIOS;
    }
  });

  test('surfaces swallowed formula errors as success_with_errors', async () => {
    const result = await ucp.calculate({
      sector: 'restaurant',
      inputs: { revenue: 100000, cogs: 35000, operating_expenses: 25000 }
    });
    expect(result.status).toBe('success_with_errors');
    expect(result.errors.length).toBeGreaterThan(0);
    const dscrError = result.errors.find(e => e.node === 'dscr');
    expect(dscrError).toBeDefined();
    expect(dscrError.scenario).toBe('scn_expected');
    expect(dscrError.type).toBe('formula');
    expect(dscrError.error).toContain('Unknown variable');
    expect(result.outputs.dscr.value).toBeUndefined();
  });

  test('keeps status success with empty errors when required outputs compute', async () => {
    const result = await ucp.calculate({
      sector: 'restaurant',
      inputs: {
        revenue: 100000,
        cogs: 35000,
        operating_expenses: 25000,
        fixed_costs: 20000,
        variable_cost_per_unit: 15,
        unit_price: 50,
        transaction_count: 2000,
        loan_amount: 100000,
        asset_value: 500000,
        net_operating_income: 80000,
        total_debt_service: 40000
      }
    });
    expect(result.status).toBe('success');
    expect(result.errors).toEqual([]);
  });

  test('storeRun persists the degraded status instead of always success', async () => {
    const inserted = [];
    ucp.supabase = {
      from: jest.fn(() => ({
        insert: (payload) => {
          inserted.push(payload);
          return { select: () => ({ single: async () => ({ data: { id: 'run-1' }, error: null }) }) };
        }
      }))
    };
    await ucp.storeRun({
      requestId: 'req-1',
      inputs: {},
      outputs: {},
      confidence: 1,
      evidence: [],
      trace: { durationMs: 1 },
      status: 'success_with_errors',
      scenarios: []
    });
    expect(inserted.length).toBe(1);
    expect(inserted[0].status).toBe('success_with_errors');
  });
});
