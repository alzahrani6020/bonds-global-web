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

async function postChat({ baseUrl, token, content, requestId, fetchImpl, sleepImpl, context }) {
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
        context: context || { pagePath:'/' },
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
  const protocolActions = Array.isArray(calculator.body?.actions) ? calculator.body.actions : [];
  assert(
    protocolActions.some(action =>
      action
      && action.type === 'site_navigate'
      && action.target === 'calculator_loan'
      && action.status !== 'denied'
    ),
    'Calculator open did not return a governed site_navigate action'
  );

  const servicePageContext = {
    pagePath: '/calculators/loan',
    serviceCode: 'funding'
  };

  const budgeting = await postChat({
    baseUrl: root,
    token,
    content: 'افتح صفحة الميزانية',
    requestId: `e2e-tool-budgeting-${now}`,
    context: servicePageContext,
    fetchImpl,
    sleepImpl
  });
  assert(budgeting.res.ok, `Budgeting page open failed: HTTP ${budgeting.res.status}`);
  assert(budgeting.body?.inference?.tool_used === true, 'Budgeting page open did not run a governed tool');
  assert(actionsOf(budgeting.body).includes('site_navigate'), 'Budgeting page open did not run site_navigate');
  assert(
    /\/budgeting/.test(String(budgeting.body?.reply || '')),
    'Budgeting page open did not return the registered budgeting route'
  );
  assert(
    !/accounting_entity_id|case_id/i.test(String(budgeting.body?.reply || '')),
    'Budgeting page open asked for an entity or case id'
  );
  const budgetingActions = Array.isArray(budgeting.body?.actions) ? budgeting.body.actions : [];
  assert(
    budgetingActions.some(action =>
      action
      && action.type === 'site_navigate'
      && action.target === 'budgeting'
      && action.status !== 'denied'
    ),
    'Budgeting page open did not return a governed site_navigate action'
  );

  const fundingCalculator = await postChat({
    baseUrl: root,
    token,
    content: 'افتح صفحة حاسبة التمويل',
    requestId: `e2e-tool-funding-calculator-${now}`,
    context: servicePageContext,
    fetchImpl,
    sleepImpl
  });
  assert(fundingCalculator.res.ok, `Funding calculator open failed: HTTP ${fundingCalculator.res.status}`);
  assert(fundingCalculator.body?.inference?.tool_used === true, 'Funding calculator open did not run a governed tool');
  assert(
    actionsOf(fundingCalculator.body).includes('calculator_open'),
    'Funding calculator open did not run calculator_open'
  );
  assert(
    /\/calculators\/loan/.test(String(fundingCalculator.body?.reply || '')),
    'Funding calculator open did not return the registered loan route'
  );
  assert(
    !/accounting_entity_id|case_id/i.test(String(fundingCalculator.body?.reply || '')),
    'Funding calculator open asked for an entity or case id'
  );

  const statementBuild = await postChat({
    baseUrl: root,
    token,
    content: 'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف',
    requestId: `e2e-tool-statement-build-${now}`,
    context: { pagePath:'/budgeting' },
    fetchImpl,
    sleepImpl
  });
  assert(statementBuild.res.ok, `Statement build failed: HTTP ${statementBuild.res.status}`);
  assert(statementBuild.body?.inference?.tool_used === true, 'Statement build did not run a governed tool');
  assert(actionsOf(statementBuild.body).includes('statement_build'), 'Statement build did not run statement_build');
  assert(!/نموذج لغوي|language model|\bLLM\b/i.test(String(statementBuild.body?.reply || '')), 'Statement build exposed model identity');
  const statementUi = Array.isArray(statementBuild.body?.ui) ? statementBuild.body.ui : [];
  assert(statementUi.length === 3, `Statement build returned ${statementUi.length} result cards instead of 3`);
  const statementTitles = statementUi.map(item => String(item?.title || ''));
  assert(statementTitles.includes('قائمة الدخل'), 'Statement build did not return income statement card');
  assert(statementTitles.includes('قائمة التدفقات النقدية'), 'Statement build did not return cash flow card');
  assert(statementTitles.includes('قائمة المركز المالي'), 'Statement build did not return financial position card');
  assert(/10,000,000/.test(JSON.stringify(statementUi)), 'Statement build did not preserve revenue 10,000,000');
  assert(/700,000/.test(JSON.stringify(statementUi)), 'Statement build did not preserve profit 700,000');

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
    `BONDS tool production smoke PASS (math_calculate=true, calculator_open=true, site_navigate=true, funding_calculator_open=true, statement_build=true, web_search=true, release=${expectedSha.slice(0, 7)})`
  );

  return {
    ok: true,
    math_calculate: true,
    calculator_open: true,
    site_navigate: true,
    funding_calculator_open: true,
    statement_build: true,
    web_search: true
  };
}

module.exports = {
  runProductionToolSmoke
};
