/**
 * Executive Command Center (ECC) API Router — Phase E.0
 *
 * Routes:
 *   POST /ecc/project-status   — unified project status aggregator
 *   POST /ecc/advisor          — AI Chief Advisor context-aware chat
 */

const { aggregateProjectStatus } = require('../../lib/ecc');
const { analyze } = require('../../lib/ai/orchestrator');
const { buildPrompt } = require('../../lib/ai/prompts');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function buildAdvisorContext(status) {
  return {
    project: status.project,
    health: status.health,
    lifecycle: status.lifecycle ? {
      currentStage: status.lifecycle.currentStage,
      allowedTransitions: (status.lifecycle.allowedTransitions || []).map(t => t.to),
      isFinal: status.lifecycle.isFinal
    } : null,
    mission: status.mission,
    documents: status.documents,
    financial: status.financial,
    intelligence: status.intelligence
      ? {
          confidence: status.intelligence.confidence,
          recommendation: status.intelligence.recommendation,
          blindSpots: status.intelligence.blindSpots
        }
      : null
  };
}

async function handleProjectStatus(req, res, path, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await parseBody(req);
    const { projectId } = body;
    if (!projectId) return sendJson(res, 400, { error: 'projectId is required' });

    const status = await aggregateProjectStatus({
      projectId,
      supabase,
      userId: user?.id
    });

    return sendJson(res, 200, { status });
  } catch (err) {
    console.error('[ecc/project-status]', err.message);
    return sendJson(res, 400, { error: err.message });
  }
}

async function handleAdvisor(req, res, path, supabase, user) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const body = await parseBody(req);
    const { projectId, message, history = [] } = body;
    if (!projectId) return sendJson(res, 400, { error: 'projectId is required' });
    if (!message) return sendJson(res, 400, { error: 'message is required' });

    const status = await aggregateProjectStatus({
      projectId,
      supabase,
      userId: user?.id
    });

    let aiResult;
    try {
      aiResult = await analyze({
        userId: user?.id,
        projectId,
        type: 'ecc_advisor',
        payload: {
          context: buildAdvisorContext(status),
          userMessage: message,
          history: history.slice(-6)
        }
      });
    } catch (err) {
      console.warn('[ecc/advisor] AI analyze failed, using fallback:', err.message);
      aiResult = {
        result: {
          reply: generateFallbackReply(message, status),
          confidence: 60,
          source: 'fallback'
        }
      };
    }

    const reply = aiResult?.result?.reply || generateFallbackReply(message, status);
    return sendJson(res, 200, {
      reply,
      confidence: aiResult?.result?.confidence || 60,
      source: aiResult?.result?.source || 'ai',
      projectId
    });
  } catch (err) {
    console.error('[ecc/advisor]', err.message);
    return sendJson(res, 400, { error: err.message });
  }
}

function generateFallbackReply(message, status) {
  const stage = status.lifecycle?.currentStage || 'idea';
  const action = status.mission?.nextBestAction;

  if (/أين|وين|حالتي|status|where/i.test(message)) {
    return `المشروع حالياً في مرحلة "${stage}". ${action ? action.action_ar : ''}`;
  }
  if (/ينقص|ناقص|missing|gap/i.test(message)) {
    const alerts = status.mission?.criticalAlerts || [];
    if (!alerts.length) return 'لا توجد تنبيهات حرجة حالياً.';
    return 'النقاط التي تحتاج اهتمامك:\n' + alerts.slice(0, 3).map(a => `• ${a.title}: ${a.message}`).join('\n');
  }
  if (/خطوة|下一步|next|priority/i.test(message)) {
    return action ? `${action.action_ar}\n${action.reason_ar}` : 'يرجى مراجعة حالة دورة الحياة.';
  }
  return `أنا مستشار بوندز. المشروع في مرحلة "${stage}". ${action ? action.action_ar : 'كيف يمكنني مساعدتك؟'}`;
}

async function eccRouter(req, res, path, supabase, user) {
  if (path === '/ecc/project-status') {
    return handleProjectStatus(req, res, path, supabase, user);
  }
  if (path === '/ecc/advisor') {
    return handleAdvisor(req, res, path, supabase, user);
  }
  return sendJson(res, 404, { error: 'ECC endpoint not found' });
}

module.exports = { eccRouter };
