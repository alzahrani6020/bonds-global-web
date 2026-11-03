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

async function postChat({ baseUrl, token, content, requestId, fetchImpl, sleepImpl }) {
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
      body: JSON.stringify({
        messages: [{ role:'user', content }],
        context: { pagePath:'/' },
        options: { max_tokens:180 }
      })
    });

    const payload = await readJsonResponse(res);
    if (res.status !== 429 || attempt === attempts) {
      return { res, body: payload };
    }

    const retryAfter = Number(res.headers?.get?.('retry-after') || 1);
    await sleepImpl(Math.max(500, Math.min(retryAfter * 1000, 3000)));
  }

  throw new Error('Tool smoke exhausted retries');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function actionsOf(body) {
  return Array.isArray(body?.inference?.actions)
    ? body.inference.actions.map(String)
    : [];
}

async function runProductionToolSmoke({
  baseUrl,
  token,
  expectedSha,
  fetchImpl = fetch,
  sleepImpl = sleep,
  log = console.log
} = {}) {
  assert(baseUrl && /^https?:\/\//i.test(baseUrl), 'Tool smoke requires a valid baseUrl');
  assert(token, 'Tool smoke requires an authenticated token');
  assert(/^[0-9a-f]{40}$/i.test(String(expectedSha || '')), 'Tool smoke requires an exact release SHA');

  const root = String(baseUrl).replace(/\/$/, '');
  const now = Date.now();

  const math = await postChat({
    baseUrl: root,
    token,
    content: 'احسب 18 بالمئة من مليون',
    requestId: `e2e-tool-math-${now}`,
    fetchImpl,
    sleepImpl
  });
  assert(math.res.ok, `Math tool failed: HTTP ${math.res.status}`);
  assert(math.body?.inference?.tool_used === true, 'Math question did not run a governed tool');
  assert(actionsOf(math.body).includes('math_calculate'), 'Math question did not run math_calculate');
  assert(/180000/.test(String(math.body?.reply || '')), 'Math question did not return 180000');
  assert(
    !/تعذر الوصول إلى خدمة الذكاء|AI service is currently unavailable/i.test(String(math.body?.reply || '')),
    'Math question fell back to the unavailable-planner reply'
  );

  const calculator = await postChat({
    baseUrl: root,
    token,
    content: 'افتح حاسبة القرض',
    requestId: `e2e-tool-calculator-${now}`,
    fetchImpl,
    sleepImpl
  });
  assert(calculator.res.ok, `Calculator open failed: HTTP ${calculator.res.status}`);
  assert(calculator.body?.inference?.tool_used === true, 'Calculator open did not run a governed tool');
  assert(actionsOf(calculator.body).includes('calculator_open'), 'Calculator open did not run calculator_open');
  assert(
    /\/calculators\/loan/.test(String(calculator.body?.reply || '')),
    'Calculator open did not return the registered loan route'
  );

  const howTo = await postChat({
    baseUrl: root,
    token,
    content: 'كيف اعمل ميزانية',
    requestId: `e2e-tool-howto-${now}`,
    fetchImpl,
    sleepImpl
  });
  assert(howTo.res.ok, `How-to search failed: HTTP ${howTo.res.status}`);
  assert(howTo.body?.inference?.tool_used === true, 'How-to question did not run a governed tool');
  assert(actionsOf(howTo.body).includes('web_search'), 'How-to question did not run web_search');
  assert(
    !/تعذر الوصول إلى خدمة الذكاء|غير موثق لدي|AI service is currently unavailable/i.test(String(howTo.body?.reply || '')),
    'How-to question returned an unfinished planner fallback'
  );

  log(
    `BONDS tool production smoke PASS (math_calculate=true, calculator_open=true, web_search=true, release=${expectedSha.slice(0, 7)})`
  );

  return {
    ok: true,
    math_calculate: true,
    calculator_open: true,
    web_search: true
  };
}

module.exports = {
  runProductionToolSmoke
};
