/**
 * @jest-environment node
 */

const { EventEmitter } = require('events');

const queryCalls = [];
function makeQuery(rows = [], error = null) {
  const state = { table:null, select:null, filters:[], statusFilters:[], subject:null, order:null, limit:null };
  const q = {
    select(fields){ state.select=fields; return q; },
    eq(key,value){ state.filters.push([key,value]); if (key === 'subject_type') state.subject=value; return q; },
    in(key,value){ state.statusFilters.push([key,value]); return q; },
    order(key,opts){ state.order=[key,opts]; return q; },
    limit(value){
      state.limit=value;
      queryCalls.push(state);
      return q;
    },
    then(resolve){ return Promise.resolve({ data:rows, error }).then(resolve); }
  };
  return { q, state };
}

const mockSupabase = {
  from:jest.fn(table => {
    const row = {
      id:table+'-1',
      user_id:'user-1',
      client_id:'client-1',
      funding_case_id:table.includes('cash_flow') ? 'case-1' : null,
      status:'draft',
      created_at:'2026-10-22T10:00:00Z',
      updated_at:'2026-10-22T11:00:00Z',
      subject_type:table === 'client_credit_consents' ? 'business' : null
    };
    const { q, state } = makeQuery([row], null);
    state.table=table;
    return q;
  })
};

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase
}));

const {
  DRAFT_SOURCES,
  normalizeDraftRow,
  listOwnedDrafts
} = require('../../lib/assistant/draft-center');
const { assistantRouter } = require('../../v3/api/assistant');

function reqGet() {
  const r = new EventEmitter();
  r.method='GET';
  return r;
}
function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[String(k).toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}
function call(path, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(reqGet(), res(resolve), path, user));
}

describe('assistant draft center', () => {
  beforeEach(() => {
    queryCalls.length=0;
    mockSupabase.from.mockClear();
  });

  test('covers the eight registered form draft sources without creating a parallel store', () => {
    expect(DRAFT_SOURCES.map(x=>x.form_code)).toEqual([
      'kyc','establishment','activity','cash_flow',
      'receivables','payables','credit_business','credit_individual'
    ]);
  });

  test('uses only columns that exist on each current draft table shape', () => {
    for (const source of DRAFT_SOURCES) {
      expect(source.fields).toContain('id');
      expect(source.fields).toContain('user_id');
      expect(source.fields).toContain('status');
      if (['kyc','establishment','activity'].includes(source.form_code)) {
        expect(source.fields).not.toContain('funding_case_id');
      } else {
        expect(source.fields).toContain('funding_case_id');
      }
      if (source.form_code.startsWith('credit_')) {
        expect(source.fields).toContain('subject_type');
      }
    }
  });

  test('normalizes editable drafts as read-only center entries', () => {
    const item = normalizeDraftRow(
      { form_code:'kyc', table:'client_kyc_cases' },
      { id:'d-1', status:'draft', updated_at:'2026-10-22T11:00:00Z' }
    );
    expect(item).toMatchObject({
      id:'d-1',
      form_code:'kyc',
      status:'draft',
      editable:true,
      source:'existing_form_draft'
    });
  });

  test('all source reads are explicitly owner-bound and draft-status-bound', async () => {
    const result = await listOwnedDrafts({
      supabase:mockSupabase,
      userId:'user-1',
      limitPerSource:10
    });

    expect(result.policy).toEqual({
      read_only:true,
      submit_allowed:false,
      write_allowed:false,
      execution_authorized:false
    });
    expect(queryCalls).toHaveLength(8);
    for (const call of queryCalls) {
      expect(call.filters).toContainEqual(['user_id','user-1']);
      expect(call.statusFilters).toContainEqual([
        'status',
        expect.arrayContaining(['draft','additional_information_required'])
      ]);
      expect(call.limit).toBe(10);
    }
  });

  test('credit consent sources are split by exact subject type', async () => {
    await listOwnedDrafts({ supabase:mockSupabase, userId:'user-1' });
    const creditCalls = queryCalls.filter(x => x.table === 'client_credit_consents');
    expect(creditCalls).toHaveLength(2);
    expect(creditCalls.map(x=>x.subject).sort()).toEqual(['business','individual']);
  });

  test('one unavailable source yields partial center instead of exposing or failing all drafts', async () => {
    let index=0;
    const sb = {
      from:jest.fn(table => {
        index += 1;
        const { q, state } = makeQuery(
          index === 3 ? [] : [{
            id:table+'-1',
            user_id:'user-1',
            status:'draft',
            created_at:'2026-10-22T10:00:00Z',
            updated_at:'2026-10-22T11:00:00Z'
          }],
          index === 3 ? { message:'source unavailable' } : null
        );
        state.table=table;
        return q;
      })
    };

    const result = await listOwnedDrafts({ supabase:sb, userId:'user-1' });
    expect(result.partial).toBe(true);
    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.source_status.some(x=>x.status === 'unavailable')).toBe(true);
  });

  test('API requires authentication', async () => {
    const response = await call('/assistant/drafts', null);
    expect(response.statusCode).toBe(401);
  });

  test('API returns a read-only unified draft center', async () => {
    const response = await call('/assistant/drafts', { id:'user-1' });
    expect(response.statusCode).toBe(200);
    expect(response.body.draft_center.policy.write_allowed).toBe(false);
    expect(response.body.draft_center.policy.submit_allowed).toBe(false);
    expect(response.body.draft_center.policy.execution_authorized).toBe(false);
    expect(Array.isArray(response.body.draft_center.drafts)).toBe(true);
  });
});
