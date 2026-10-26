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

function safeDiagnosticsSummary(body = {}) {
  const diagnostics = body && typeof body === 'object' ? body.diagnostics || null : null;
  const evidence = diagnostics && typeof diagnostics === 'object' ? diagnostics.evidence || null : null;
  const inference = body && typeof body === 'object' ? body.inference || null : null;

  return {
    source: typeof body?.source === 'string' ? body.source : null,
    tool_used: inference?.tool_used === true,
    actions: Array.isArray(inference?.actions) ? inference.actions.slice(0, 8).map(String) : [],
    path: typeof diagnostics?.path === 'string' ? diagnostics.path : null,
    status: typeof diagnostics?.status === 'string' ? diagnostics.status : null,
    pipeline_stage: typeof diagnostics?.pipeline_stage === 'string' ? diagnostics.pipeline_stage : null,
    root_cause_stage: typeof diagnostics?.root_cause_stage === 'string' ? diagnostics.root_cause_stage : null,
    failure_stage: typeof diagnostics?.failure_stage === 'string' ? diagnostics.failure_stage : null,
    error_code: typeof diagnostics?.error_code === 'string' ? diagnostics.error_code : null,
    decision_eligible: typeof evidence?.decision_eligible === 'boolean' ? evidence.decision_eligible : null,
    source_count: Number.isFinite(Number(evidence?.source_count)) ? Number(evidence.source_count) : null,
    evidence_count: Number.isFinite(Number(evidence?.evidence_count)) ? Number(evidence.evidence_count) : null,
    unknown_count: Number.isFinite(Number(evidence?.unknown_count)) ? Number(evidence.unknown_count) : null,
    contradiction_count: Number.isFinite(Number(evidence?.contradiction_count)) ? Number(evidence.contradiction_count) : null
  };
}

function containsOfficialMofDomain(value) {
  const text = String(value || '');
  const candidates = text.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];

  for (const candidate of candidates) {
    try {
      const hostname = new URL(candidate).hostname.toLowerCase().replace(/\.$/, '');
      if (hostname === 'mof.gov.sa' || hostname.endsWith('.mof.gov.sa')) {
        return true;
      }
    } catch {}
  }

  return false;
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
  const diagnostics = first.body?.diagnostics || null;
  const evidenceBacked =
    diagnostics?.path === 'OPEN_CHAT_RESEARCH' &&
    diagnostics?.evidence?.decision_eligible === true &&
    Number(diagnostics?.evidence?.source_count || 0) > 0 &&
    diagnostics?.status !== 'FAIL';

  if (!evidenceBacked) {
    log(
      'BONDS conversational smoke diagnostics ' +
      JSON.stringify(safeDiagnosticsSummary(first.body))
    );
  }

  assert(
    evidenceBacked,
    'Conversational research did not prove a successful evidence-backed research pipeline'
  );
  assert(
    containsOfficialMofDomain(first.body?.reply),
    'Conversational research did not return the verified official mof.gov.sa domain'
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
    'Conversational follow-up lost the verified official mof.gov.sa reference'
  );

  log(
    `BONDS conversational production smoke PASS (research_tool_used=true, evidence_backed=true, official_domain=true, follow_up_context=true, release=${expectedSha.slice(0, 7)})`
  );

  return {
    ok:true,
    research_tool_used:true,
    evidence_backed:true,
    follow_up_context:true,
    official_domain:'mof.gov.sa'
  };
}

module.exports = {
  containsOfficialMofDomain,
  safeDiagnosticsSummary,
  runProductionConversationalSmoke
};
