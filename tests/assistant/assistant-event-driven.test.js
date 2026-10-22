/**
 * @jest-environment node
 */

const { EventEmitter } = require('events');

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc:jest.fn() })
}));

const {
  ALLOWED_EVENTS,
  normalizeAssistantEvent,
  suggestFromAssistantEvent
} = require('../../lib/assistant/event-driven');
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
    setHeader(k,v){ this.headers[String(k).toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function call(path, body, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(req(body), res(resolve), path, user));
}

describe('assistant event-driven foundation', () => {
  test('event whitelist is explicit and bounded', () => {
    expect(Object.keys(ALLOWED_EVENTS)).toEqual([
      'form_saved',
      'document_uploaded',
      'case_status_changed',
      'page_changed'
    ]);
  });

  test('rejects unregistered event types', () => {
    expect(() => normalizeAssistantEvent({
      type:'run_sql',
      metadata:{ sql:'drop table x' }
    })).toThrow('ASSISTANT_EVENT_TYPE_NOT_ALLOWED');
  });

  test('drops nested event metadata and bounds scalar text', () => {
    const event = normalizeAssistantEvent({
      type:'form_saved',
      boundary:'project:p-1',
      resource_id:'kyc',
      metadata:{
        status:'draft',
        nested:{ unsafe:true },
        huge:'x'.repeat(1000)
      }
    });

    expect(event.metadata.nested).toBeUndefined();
    expect(event.metadata.status).toBe('draft');
    expect(event.metadata.huge).toHaveLength(300);
  });

  test.each([
    ['form_saved','form_load'],
    ['document_uploaded','document_find'],
    ['case_status_changed','funding_next_step'],
    ['page_changed',null]
  ])('%s returns suggestion only', (type, capability) => {
    const out = suggestFromAssistantEvent({
      type,
      boundary:'project:p-1',
      resource_id:'resource-1'
    });

    expect(out.suggestion.capability).toBe(capability);
    expect(out.suggestion.status).toBe('suggested');
    expect(out.suggestion.requires_user_action).toBe(true);
    expect(out.auto_execute).toBe(false);
    expect(out.auto_write).toBe(false);
    expect(out.execution_authorized).toBe(false);
  });

  test('API requires authentication', async () => {
    const response = await call('/assistant/events/suggest', {
      event:{ type:'page_changed' }
    }, null);

    expect(response.statusCode).toBe(401);
  });

  test('API rejects unknown events without dynamic dispatch', async () => {
    const response = await call('/assistant/events/suggest', {
      event:{
        type:'arbitrary_webhook',
        url:'https://example.com',
        javascript:'alert(1)'
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe('ASSISTANT_EVENT_TYPE_NOT_ALLOWED');
  });

  test('API returns suggestion with no execution authority', async () => {
    const response = await call('/assistant/events/suggest', {
      event:{
        type:'document_uploaded',
        boundary:'project:p-1',
        resource_id:'doc-1',
        metadata:{ filename:'bank.pdf' }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.suggestion.auto_execute).toBe(false);
    expect(response.body.suggestion.auto_write).toBe(false);
    expect(response.body.suggestion.execution_authorized).toBe(false);
    expect(response.body.suggestion.suggestion.capability).toBe('document_find');
  });
});
