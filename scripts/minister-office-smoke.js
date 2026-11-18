'use strict';

async function assertMinisterOfficeSmoke({baseUrl,token,request,now = Date.now,
  question='من هو وزير الداخلية السعودي؟',portfolio='الداخلية',conversationMode='execute'} = {}) {
  if (!['الداخلية','الخارجية','المالية'].includes(portfolio)) throw new Error('OFFICE_SMOKE_PORTFOLIO_REQUIRED');
  const requestId = 'e2e-minister-office-' + now();
  const started = now();
  const chat = await request(baseUrl.replace(/\/$/u, '') + '/api/v3/ai/chat', {
    method:'POST', headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json',
      'Cache-Control':'no-cache','X-Request-ID':requestId},
    body:JSON.stringify({messages:[{role:'user',content:question}],
      context:{},conversation_mode:conversationMode,options:{max_tokens:256}})
  });
  const elapsed = now() - started;
  const reply = String(chat.body?.reply || '').trim();
  const name = reply.match(new RegExp('^([\\p{L}\\p{M}]+(?:\\s+[\\p{L}\\p{M}]+){2,14})\\s+هو\\s+وزير\\s+'+portfolio,'u'));
  const urls = reply.match(/https:\/\/[^\s<>]+/gu) || [];
  if (!chat.res.ok || chat.body?.fallback_reason ||
      chat.body?.inference?.planner !== 'universal-v2-deterministic-research' ||
      chat.body?.inference?.tool_used !== true || !name || !urls.length || elapsed > 30000) {
    throw new Error('MINISTER_OFFICE_SMOKE_FAILED request_id=' + requestId +
      ' elapsed_ms=' + elapsed + ' http=' + chat.res.status +
      ' has_holder=' + Boolean(name) + ' has_source=' + Boolean(urls.length) + ' portfolio=' + portfolio);
  }
  console.log('Authenticated minister office PASS (verified holder and source, elapsed_ms=' + elapsed + ', portfolio=' + portfolio + ', mode=' + conversationMode + ')');
}

module.exports = {assertMinisterOfficeSmoke};
