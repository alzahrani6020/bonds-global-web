/** @jest-environment node */

const { EventEmitter } = require('events');

const mockFrom = jest.fn();
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: mockFrom })
}));

const { assistantRouter } = require('../../v3/api/assistant');

function req(body) {
  const r = new EventEmitter();
  r.method = 'POST';
  process.nextTick(() => {
    r.emit('data', Buffer.from(JSON.stringify(body || {})));
    r.emit('end');
  });
  return r;
}

function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function call(body, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(
    req(body),
    res(resolve),
    '/assistant/documents/workflow-suggestions',
    user
  ));
}

function setupOwnedFlow({ documentProject='project-1', caseProject='project-1' } = {}) {
  mockFrom.mockImplementation(table => {
    if (table === 'funding_cases') {
      return {
        select:() => ({
          eq:() => ({
            eq:() => ({
              maybeSingle:jest.fn().mockResolvedValue({
                data:{
                  id:'case-1',
                  user_id:'user-1',
                  project_id:caseProject,
                  status:'draft',
                  case_reference:'FC-1'
                },
                error:null
              })
            })
          })
        })
      };
    }

    if (table === 'client_documents') {
      return {
        select:() => ({
          eq:() => ({
            eq:() => ({
              maybeSingle:jest.fn().mockResolvedValue({
                data:{
                  id:'doc-1',
                  client_id:'client-1',
                  project_id:documentProject,
                  filename:'commercial-registration.pdf',
                  mime_type:'application/pdf',
                  size_bytes:1024,
                  status:'analyzed',
                  extracted_data:{
                    text:'السجل التجاري رقم 1010123456'
                  },
                  created_at:'2026-10-22T00:00:00Z',
                  updated_at:'2026-10-22T00:00:00Z'
                },
                error:null
              })
            })
          })
        })
      };
    }

    if (table === 'funding_file_requirements') {
      return {
        select:() => ({
          eq:jest.fn().mockResolvedValue({
            data:[{
              id:'req-establishment',
              code:'establishment',
              stage_id:'stage-1',
              label_ar:'بيانات المنشأة',
              label_en:'Establishment',
              is_active:true,
              completion_statuses:['submitted','under_review','approved']
            }],
            error:null
          })
        })
      };
    }

    if (table === 'funding_case_submissions') {
      return {
        select:() => ({
          eq:jest.fn().mockResolvedValue({ data:[], error:null })
        })
      };
    }

    throw new Error('UNEXPECTED_TABLE_' + table);
  });
}

describe('document-to-workflow API contract', () => {
  beforeEach(() => mockFrom.mockReset());

  test('requires authentication before any workflow lookup', async () => {
    const out = await call({ document_id:'doc-1', case_id:'case-1' }, null);
    expect(out.statusCode).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns owned document workflow suggestions without business writes', async () => {
    setupOwnedFlow();

    const out = await call({ document_id:'doc-1', case_id:'case-1' });

    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.workflow).toMatchObject({
      case_id:'case-1',
      document_id:'doc-1',
      document_type:'commercial_registration',
      blocked_from_auto_write:true
    });
    expect(out.body.workflow.suggestions).toHaveLength(1);
    expect(out.body.workflow.suggestions[0]).toMatchObject({
      requirement_code:'establishment',
      current_status:'not_started',
      policy:{
        suggestion_only:true,
        auto_submit:false,
        requires_user_confirmation:true
      }
    });

    expect(mockFrom.mock.calls.map(call => call[0])).toEqual([
      'funding_cases',
      'client_documents',
      'funding_file_requirements',
      'funding_case_submissions'
    ]);
  });

  test('fails closed when owned document belongs to another project', async () => {
    setupOwnedFlow({ documentProject:'project-2', caseProject:'project-1' });

    const out = await call({ document_id:'doc-1', case_id:'case-1' });

    expect(out.statusCode).toBe(409);
    expect(out.body.error).toBe('DOCUMENT_CASE_PROJECT_CONFLICT');
    expect(mockFrom.mock.calls.map(call => call[0])).toEqual([
      'funding_cases',
      'client_documents'
    ]);
  });
});
