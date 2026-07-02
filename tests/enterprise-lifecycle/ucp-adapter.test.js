const mockCalculate = jest.fn();

jest.mock('../../lib/ucp', () => ({
  UniversalCalculationPlatform: {
    create: jest.fn(() => Promise.resolve({
      calculate: mockCalculate
    }))
  }
}));

const { UcpAdapter } = require('../../lib/enterprise-lifecycle/integrations/ucp-adapter');

describe('UcpAdapter', () => {
  beforeEach(() => {
    mockCalculate.mockReset();
    mockCalculate.mockResolvedValue({ confidence: 85, outputs: {}, scenarios: [] });
  });

  test('passes project.id as projectId to UCP', async () => {
    const supabase = { from: jest.fn() };
    const adapter = new UcpAdapter({ supabase });
    const context = {
      project: { id: 'proj-123', sector: 'retail', country_code: 'SA' },
      userId: 'u1',
      inputs: { revenue: 100000 }
    };
    await adapter.enrich({
      instance: { entity_id: 'proj-123', entity_type: 'project' },
      context
    });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    const call = mockCalculate.mock.calls[0][0];
    expect(call.projectId).toBe('proj-123');
    expect(call.sector).toBe('retail');
    expect(call.country).toBe('SA');
  });

  test('falls back to instance.entity_id when project.id is missing', async () => {
    const supabase = { from: jest.fn() };
    const adapter = new UcpAdapter({ supabase });
    const context = {
      project: { sector: 'restaurant', country_code: 'AE' },
      userId: 'u2'
    };
    await adapter.enrich({
      instance: { entity_id: 'ent-456', entity_type: 'project' },
      context
    });
    expect(mockCalculate).toHaveBeenCalledTimes(1);
    const call = mockCalculate.mock.calls[0][0];
    expect(call.projectId).toBe('ent-456');
  });

  test('returns context unchanged when sector/country missing', async () => {
    const supabase = { from: jest.fn() };
    const adapter = new UcpAdapter({ supabase });
    const context = { inputs: {} };
    const result = await adapter.enrich({
      instance: { entity_id: 'ent-789', entity_type: 'project' },
      context
    });
    expect(mockCalculate).not.toHaveBeenCalled();
    expect(result).toBe(context);
  });
});
