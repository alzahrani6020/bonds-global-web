/** @jest-environment node */
const { EventEmitter } = require('events');
jest.mock('../../v3/lib/auth', () => ({ getUserFromToken:jest.fn() }));
jest.mock('../../v3/lib/supabase', () => ({ getSupabaseClient:() => ({}) }));
jest.mock('../../lib/assistant/execute-entitlement', () => ({ isExecuteEntitled:async () => false }));
jest.mock('../../lib/assistant/universal-orchestrator', () => ({
  runUniversalOrchestrator:jest.fn(), isFastPublicFact:jest.fn(), runDeterministicLocalTools:jest.fn()
}));
const { getUserFromToken } = require('../../v3/lib/auth');
const { runUniversalOrchestrator } = require('../../lib/assistant/universal-orchestrator');
const { resolveExecuteRequest } = require('../../lib/assistant/execute-requests');
const { aiChatHandler } = require('../../v3/api/ai');

async function chat(text, user = { id:'user-1' }) {
  getUserFromToken.mockResolvedValueOnce(user);
  const req = new EventEmitter();
  req.method = 'POST'; req.headers = {};
  const res = new EventEmitter();
  res.setHeader = () => {};
  const response = new Promise(resolve => {
    res.end = body => { res.writableEnded = true; resolve({status:res.statusCode, body:JSON.parse(body)}); };
  });
  const pending = aiChatHandler(req, res);
  req.emit('data', Buffer.from(JSON.stringify({messages:[{role:'user',content:text}],conversation_mode:'execute'})));
  req.emit('end');
  await pending;
  return response;
}

describe('execute-mode registered forms', () => {
  beforeEach(() => jest.clearAllMocks());
  test('the live failure prompt returns local form controls without public research', async () => {
    const out = await chat('ابحث عن نموذج طلب تمويل في هذا الموقع');
    expect(out.status).toBe(200);
    expect(out.body.actions.map(a => a.target)).toEqual(['kyc','establishment','activity']);
    expect(out.body.execution_completed).toBe(false);
    expect(out.body.reply).not.toMatch(/تم حفظ|wikipedia/iu);
    expect(runUniversalOrchestrator).not.toHaveBeenCalled();
  });
  test('prepares a draft action without claiming a write', async () => {
    const out = await chat('احفظ مسودة نموذج بيانات المنشأة');
    expect(out.body.actions[0]).toMatchObject({type:'form_save_draft',target:'establishment'});
    expect(out.body.reply).toContain('لم تُحفظ');
    expect(out.body.execution_completed).toBe(false);
  });
  test('guest requests still fail before preparing an action', async () => {
    const out = await chat('افتح نموذج اعرف عميلك', null);
    expect(out.status).toBe(401);
    expect(out.body.actions).toBeUndefined();
  });
  test.each([
    ['افتح نموذج اعرف عميلك','kyc'],
    ['Open the establishment form','establishment'],
    ['حمّل نموذج التدفقات النقدية','cash_flow']
  ])('resolves a registered form: %s', (text, target) => {
    expect(resolveExecuteRequest(text, {}, {conversationMode:'execute'}).actions[0])
      .toMatchObject({type:'form_load',target});
  });
  test('does not swallow general discussion or explicit public research', () => {
    expect(resolveExecuteRequest('ابحث في الإنترنت عن نماذج التمويل', {}, {conversationMode:'execute'})).toBeNull();
    expect(resolveExecuteRequest('افتح نموذج اعرف عميلك', {}, {conversationMode:'general'})).toBeNull();
    expect(resolveExecuteRequest('افتح حاسبة العائد', {}, {conversationMode:'execute'})).toBeNull();
  });
});
