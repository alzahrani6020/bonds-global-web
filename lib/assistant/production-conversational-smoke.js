'use strict';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function postChat({ baseUrl, token, body, requestId, fetchImpl, sleepImpl }) {
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const res = await fetchImpl(`${baseUrl}/api/v3/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(body)
    });

    const payload = await readJsonResponse(res);

    if (res.status !== 429 || attempt === attempts) {
      return { res, body: payload };
    }

    const retryAfter = Number(res.headers?.get?.('retry-after') || 1);
    const delayMs = Math.max(500, Math.min(retryAfter * 1000, 3000));
    await sleepImpl(delayMs);
  }

  throw new Error('Conversational smoke exhausted retries');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function containsOfficialMofDomain(value) {
  return /(?:https?:\/\/)?(?:www\.)?mof\.gov\.sa(?:\b|\/)/i.test(String(value || ''));
}

async function runProductionConversationalSmoke({
  baseUrl,
  token,
  expectedSha,
  fetchImpl = fetch,
  sleepImpl = sleep,
  log = console.log
} = {}) {
  assert(baseUrl && /^https?:\/\//i.test(baseUrl), 'Conversational smoke requires a valid baseUrl');
  assert(token, 'Conversational smoke requires an authenticated token');
  assert(/^[0-9a-f]{40}$/i.test(String(expectedSha || '')), 'Conversational smoke requires an exact release SHA');

  const question = 'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.';
  const firstRequestId = `e2e-conversation-search-${Date.now()}`;
  const first = await postChat({
    baseUrl: String(baseUrl).replace(/\/$/, ''),
    token,
    requestId: firstRequestId,
    fetchImpl,
    sleepImpl,
    body: {
      messages: [{ role:'user', content:question }],
      context: { pagePath:'/' },
      options: { max_tokens:180 }
    }
  });

  assert(first.res.ok, `Conversational research failed: HTTP ${first.res.status}`);
  assert(String(first.body?.reply || '').trim(), 'Conversational research returned an empty reply');
  assert(
    first.body?.source === 'bonds-assistant-ai-tool' &&
      first.body?.inference?.tool_used === true,
    `Conversational research did not prove governed tool use: source=${first.body?.source || 'missing'}`
  );
  assert(
    containsOfficialMofDomain(first.body?.reply),
    'Conversational research did not return the official mof.gov.sa domain'
  );

  const followUp = 'ما الرابط الرسمي الذي وجدته في الإجابة السابقة؟ أجب بالرابط فقط.';
  const secondRequestId = `e2e-conversation-followup-${Date.now()}`;
  const second = await postChat({
    baseUrl: String(baseUrl).replace(/\/$/, ''),
    token,
    requestId: secondRequestId,
    fetchImpl,
    sleepImpl,
    body: {
      messages: [
        { role:'user', content:question },
        { role:'assistant', content:String(first.body.reply) },
        { role:'user', content:followUp }
      ],
      context: { pagePath:'/' },
      options: { max_tokens:80 }
    }
  });

  assert(second.res.ok, `Conversational follow-up failed: HTTP ${second.res.status}`);
  assert(String(second.body?.reply || '').trim(), 'Conversational follow-up returned an empty reply');
  assert(
    containsOfficialMofDomain(second.body?.reply),
    'Conversational follow-up lost the official mof.gov.sa reference'
  );

  log(
    `BONDS conversational production smoke PASS (research_tool_used=true, follow_up_context=true, release=${expectedSha.slice(0, 7)})`
  );

  return {
    ok:true,
    research_tool_used:true,
    follow_up_context:true,
    official_domain:'mof.gov.sa'
  };
}

module.exports = {
  containsOfficialMofDomain,
  runProductionConversationalSmoke
};
