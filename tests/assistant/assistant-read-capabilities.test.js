/**
 * @jest-environment node
 */

const {
  getCapability,
  getService,
  validateCapabilityInput
} = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');
const supabase = require('../../v3/lib/supabase');

function makeAssistantDb() {
  const stage = {
    id:'stage-1',
    code:'financial',
    label_ar:'مالي',
    label_en:'Financial',
    sort_order:1
  };

  const requirements = [
    {
      id:'req-1',
      code:'cash_flow',
      stage_id:'stage-1',
      label_ar:'التدفق النقدي',
      label_en:'Cash flow',
      data_scope:'case',
      sort_order:1,
      is_required:true,
      completion_statuses:['approved']
    },
    {
      id:'req-2',
      code:'bank_statement',
      stage_id:'stage-1',
      label_ar:'كشف الحساب',
      label_en:'Bank statement',
      data_scope:'case',
      sort_order:2,
      is_required:true,
      completion_statuses:['approved']
    }
  ];

  return {
    from(table) {
      if (table === 'funding_cases') {
        const filters = {};
        return {
          select() { return this; },
          eq(field, value) {
            filters[field] = value;
            return this;
          },
          async maybeSingle() {
            if (
              filters.id === 'case-1' &&
              filters.user_id === 'user-1'
            ) {
              return {
                data:{
                  id:'case-1',
                  case_reference:'FC-001',
                  status:'draft',
                  project_id:'project-1',
                  user_id:'user-1',
                  next_action_at:null,
                  amount:100000,
                  financing_type:'working_capital',
                  updated_at:'2026-10-22T00:00:00.000Z'
                },
                error:null
              };
            }
            return { data:null, error:null };
          }
        };
      }

      if (table === 'funding_file_stages') {
        return {
          select() { return this; },
          async eq() {
            return { data:[stage], error:null };
          }
        };
      }

      if (table === 'funding_file_requirements') {
        return {
          select() { return this; },
          async eq() {
            return { data:requirements, error:null };
          }
        };
      }

      if (table === 'funding_case_submissions') {
        return {
          select() { return this; },
          async eq(field, value) {
            if (field !== 'case_id' || value !== 'case-1') {
              return { data:[], error:null };
            }
            return {
              data:[{
                requirement_id:'req-1',
                status:'approved',
                submitted_at:'2026-10-21T00:00:00.000Z',
                source_record_id:'source-1',
                updated_at:'2026-10-21T00:00:00.000Z'
              }],
              error:null
            };
          }
        };
      }

      if (table === 'bonds_projects') {
        const filters = {};
        return {
          select() { return this; },
          eq(field, value) {
            filters[field] = value;
            return this;
          },
          async maybeSingle() {
            if (
              filters.id === 'project-1' &&
              filters.user_id === 'user-1'
            ) {
              return {
                data:{
                  id:'project-1',
                  name:'Owned project',
                  project_number:'P-001',
                  sector:'services',
                  sub_sector:null,
                  activity:null,
                  currency:'SAR',
                  status:'active',
                  capital:100000,
                  revenue:0,
                  annual_profit:0,
                  language:'ar',
                  metadata:{},
                  created_at:'2026-10-20T00:00:00.000Z',
                  updated_at:'2026-10-22T00:00:00.000Z'
                },
                error:null
              };
            }
            return { data:null, error:null };
          }
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

describe('assistant read capabilities', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('assistant service is enabled without performance ceilings or service-token coupling', () => {
    const service = getService('assistant');
    expect(service).toBeTruthy();
    expect(service.enabled).toBe(true);
    expect(service.security.serviceTokenRequired).toBe(false);
    expect(service.limits).toEqual({
      requestsPerMinute: null,
      retryMaxAttempts: null
    });
  });

  test.each([
    'site_navigate',
    'form_find',
    'form_load',
    'funding_status',
    'funding_next_step',
    'funding_next_requirements',
    'project_status'
  ])('%s is registered and active', action => {
    const capability = getCapability(action);
    expect(capability).toBeTruthy();
    expect(capability.active).toBe(true);
    expect(capability.serviceCode).toBe('assistant');
  });

  test('required resource identifiers are validated before execution', () => {
    expect(validateCapabilityInput('funding_status', {}).code).toBe('MISSING_INPUTS');
    expect(validateCapabilityInput('project_status', {}).code).toBe('MISSING_INPUTS');
    expect(validateCapabilityInput('site_navigate', {}).code).toBe('MISSING_INPUTS');
  });

  test('site navigation resolves only a registered logical target', async () => {
    const adapter = getRuntimeAdapter('assistant_site_navigate');
    const ok = await adapter({ target:'cash_flow', language:'ar' });
    expect(ok).toMatchObject({
      ok:true,
      executed:true,
      result:{
        target:'cash_flow',
        route:'/client/cash-flow'
      }
    });
    expect(ok.result.url).toBeUndefined();

    const denied = await adapter({ target:'https://evil.example' });
    expect(denied).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:404,
      error:{ code:'NAVIGATION_TARGET_NOT_REGISTERED' }
    });
  });

  test('form discovery and load remain registry-bound', async () => {
    const find = getRuntimeAdapter('assistant_form_find');
    const load = getRuntimeAdapter('assistant_form_load');

    const found = await find({ form:'cash_flow' });
    expect(found).toMatchObject({
      ok:true,
      result:{
        form:'cash_flow',
        navigation_target:'cash_flow',
        funding_requirement:'cash_flow',
        data_scope:'case'
      }
    });

    const loaded = await load({ form:'cash_flow', language:'en' });
    expect(loaded).toMatchObject({
      ok:true,
      result:{
        form:'cash_flow',
        navigation:{
          target:'cash_flow',
          route:'/en/client/cash-flow'
        }
      }
    });

    expect((await load({ form:'unknown' })).error.code).toBe('FORM_NOT_REGISTERED');
  });

  test('funding reads are resource-bound to the signed-in user', async () => {
    jest.spyOn(supabase, 'getSupabaseClient').mockReturnValue(makeAssistantDb());
    const adapter = getRuntimeAdapter('assistant_funding_status');

    const owned = await adapter(
      { case_id:'case-1', language:'ar' },
      { userId:'user-1', actor:{ id:'user-1' } }
    );
    expect(owned).toMatchObject({
      ok:true,
      executed:true,
      result:{
        case:{ id:'case-1', case_reference:'FC-001' }
      }
    });

    const foreign = await adapter(
      { case_id:'case-1', language:'ar' },
      { userId:'user-2', actor:{ id:'user-2' } }
    );
    expect(foreign).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:404,
      error:{ code:'FUNDING_CASE_NOT_FOUND' }
    });
  });

  test('funding next-step logic returns the first required incomplete requirement', async () => {
    jest.spyOn(supabase, 'getSupabaseClient').mockReturnValue(makeAssistantDb());
    const adapter = getRuntimeAdapter('assistant_funding_next_step');

    const result = await adapter(
      { case_id:'case-1', language:'ar' },
      { userId:'user-1', actor:{ id:'user-1' } }
    );

    expect(result).toMatchObject({
      ok:true,
      executed:true,
      result:{
        completed_count:1,
        missing_count:1,
        next:{
          code:'bank_statement',
          completed:false,
          status:'missing'
        }
      }
    });
  });

  test('project reads are resource-bound to the signed-in user', async () => {
    jest.spyOn(supabase, 'getSupabaseClient').mockReturnValue(makeAssistantDb());
    const adapter = getRuntimeAdapter('assistant_project_status');

    const owned = await adapter(
      { project_id:'project-1' },
      { userId:'user-1', actor:{ id:'user-1' } }
    );
    expect(owned).toMatchObject({
      ok:true,
      executed:true,
      result:{ project:{ id:'project-1', name:'Owned project' } }
    });

    const foreign = await adapter(
      { project_id:'project-1' },
      { userId:'user-2', actor:{ id:'user-2' } }
    );
    expect(foreign).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:404,
      error:{ code:'PROJECT_NOT_FOUND' }
    });
  });

  test('assistant user-scoped reads fail closed when actor identity does not match user context', async () => {
    jest.spyOn(supabase, 'getSupabaseClient').mockReturnValue(makeAssistantDb());
    const funding = getRuntimeAdapter('assistant_funding_status');
    const project = getRuntimeAdapter('assistant_project_status');

    expect(await funding(
      { case_id:'case-1' },
      { userId:'user-1', actor:{ id:'user-2' } }
    )).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:503,
      error:{ code:'USER_GOVERNANCE_UNAVAILABLE' }
    });

    expect(await project(
      { project_id:'project-1' },
      { userId:'user-1', actor:{ id:'user-2' } }
    )).toMatchObject({
      ok:false,
      executed:false,
      httpStatus:503,
      error:{ code:'USER_GOVERNANCE_UNAVAILABLE' }
    });
  });
});
