/**
 * @jest-environment node
 */

const mockSendEmail = jest.fn(() => Promise.resolve({ success: true }));

jest.mock('../../lib/api/email', () => ({
  sendEmail: mockSendEmail
}));

const FundingCases = require('../../lib/api/funding-cases-admin');

function createMockRow(overrides = {}) {
  return {
    id: 'case-1',
    case_reference: 'BF-2026-000001',
    status: 'new',
    name: 'Test Client',
    email: 'client@example.com',
    company: 'Test Co',
    phone: '+966500000000',
    amount: 100000,
    assigned_to: null,
    provider_name: null,
    internal_notes: null,
    next_action_at: null,
    sla_deadline_at: null,
    client_id: null,
    project_id: null,
    ...overrides
  };
}

function createChain(result = { data: null, error: null, count: 0 }) {
  const state = {
    data: result.data,
    error: result.error,
    count: result.count
  };
  const chain = {
    select: jest.fn((cols, opts) => {
      if (opts?.count === 'exact') state.count = result.count;
      return chain;
    }),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    not: jest.fn(() => chain),
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    insert: jest.fn((rows) => {
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      state.data = inserted;
      return chain;
    }),
    update: jest.fn((set) => {
      if (set && typeof set === 'object') {
        state.data = { ...(state.data || {}), ...set };
      }
      return chain;
    }),
    upsert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data: state.data, error: state.error })),
    single: jest.fn(() => Promise.resolve({ data: state.data, error: state.error })),
    then: (resolve) => resolve({ data: state.data, error: state.error, count: state.count })
  };
  return chain;
}

function createMockSb(overrides = {}) {
  const tableResults = {
    funding_cases: { data: createMockRow(), error: null, count: 1 },
    funding_case_events: { data: { id: 'event-1' }, error: null, count: 1 },
    funding_case_documents: { data: [], error: null, count: 0 },
    funding_case_allowed_transitions: { data: [{ to_status: 'initial_review' }], error: null, count: 1 },
    notification_templates: { data: { key: 'funding_status_changed', subject_ar: 'subject', body_ar: 'body {{name}}' }, error: null },
    admin_roles: { data: null, error: null },
    advisory_roles: { data: null, error: null },
    profiles: { data: null, error: null },
    ...overrides
  };

  return {
    from: jest.fn((table) => {
      const result = tableResults[table] || { data: null, error: null, count: 0 };
      return createChain(result);
    }),
    rpc: jest.fn((name, args) => {
      if (name === 'capture_lead') return Promise.resolve({ data: 'client-1', error: null });
      if (name === 'create_advisory_project_from_funding_case') return Promise.resolve({ data: 'project-1', error: null });
      return Promise.resolve({ data: null, error: null });
    }),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'case-1/file.pdf' }, error: null })),
        createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed.url/file.pdf' }, error: null }))
      }))
    }
  };
}

const actor = { id: 'admin-1', email: 'admin@example.com' };

describe('funding-cases-admin', () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  describe('updateFundingCase', () => {
    test('allows valid status transition and sends notification', async () => {
      const sb = createMockSb();
      const result = await FundingCases.updateFundingCase(sb, 'case-1', { status: 'initial_review' }, actor);
      expect(result.status).toBe('initial_review');
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid status transition', async () => {
      const sb = createMockSb({
        funding_case_allowed_transitions: { data: [], error: null, count: 0 }
      });
      await expect(FundingCases.updateFundingCase(sb, 'case-1', { status: 'approved' }, actor))
        .rejects.toThrow('Transition from new to approved is not allowed');
    });

    test('auto-fills approved_at when status becomes approved', async () => {
      const sb = createMockSb({
        funding_case_allowed_transitions: { data: [{ to_status: 'approved' }], error: null, count: 1 },
        funding_cases: { data: createMockRow({ status: 'approved' }), error: null }
      });
      const result = await FundingCases.updateFundingCase(sb, 'case-1', { status: 'approved' }, actor);
      expect(result.approved_at).toBeTruthy();
    });
  });

  describe('requestDocument', () => {
    test('creates document requested event and notifies client', async () => {
      const sb = createMockSb();
      const result = await FundingCases.requestDocument(sb, 'case-1', { documentType: 'bank_statement', note: 'please upload' }, actor);
      expect(result.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid document type', async () => {
      const sb = createMockSb();
      await expect(FundingCases.requestDocument(sb, 'case-1', { documentType: 'invalid' }, actor))
        .rejects.toThrow('Invalid document type');
    });
  });

  describe('uploadDocument', () => {
    test('uploads base64 file and creates document record', async () => {
      const sb = createMockSb();
      const file = { name: 'statement.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjAK' };
      const result = await FundingCases.uploadDocument(sb, 'case-1', file, actor);
      expect(result.success).toBe(true);
      expect(result.document).toBeTruthy();
    });

    test('rejects disallowed file type', async () => {
      const sb = createMockSb();
      const file = { name: 'app.exe', type: 'application/x-msdownload', data: 'data:application/x-msdownload;base64,AAAA' };
      await expect(FundingCases.uploadDocument(sb, 'case-1', file, actor))
        .rejects.toThrow('File type not allowed');
    });
  });

  describe('linkAdvisoryClient', () => {
    test('creates new advisory client and project from case', async () => {
      const sb = createMockSb();
      const result = await FundingCases.linkAdvisoryClient(sb, 'case-1', { createNew: true }, actor);
      expect(result.success).toBe(true);
      expect(result.clientId).toBe('client-1');
      expect(result.projectId).toBe('project-1');
    });
  });

  describe('getFundingCaseKpis', () => {
    test('returns aggregate KPIs', async () => {
      const sb = createMockSb({
        funding_cases: { data: [{ status: 'new' }, { status: 'approved', amount: 200000 }, { status: 'approved', amount: 300000 }], error: null, count: 3 }
      });
      const result = await FundingCases.getFundingCaseKpis(sb);
      expect(result.success).toBe(true);
      expect(result.kpis.total).toBe(3);
      expect(result.kpis.avgAmount).toBe(250000);
      expect(result.kpis.conversionRate).toBe('100.0');
    });
  });

  describe('listAssignees', () => {
    test('returns combined admin and advisory users', async () => {
      const sb = createMockSb({
        admin_roles: {
          data: [{ user_id: 'u1', role: 'admin', profiles: { email: 'a@x.com', restaurant_name: 'Admin' } }],
          error: null
        },
        advisory_roles: {
          data: [{ user_id: 'u2', role: 'manager', profiles: { email: 'm@x.com', restaurant_name: 'Manager' } }],
          error: null
        }
      });
      const result = await FundingCases.listAssignees(sb);
      expect(result.success).toBe(true);
      expect(result.assignees).toHaveLength(2);
    });
  });
});
