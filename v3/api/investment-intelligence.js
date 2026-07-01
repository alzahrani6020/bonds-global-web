/**
 * BONDS Investment Intelligence API Router — Phase D.1
 *
 * Handles /investment-intelligence/* endpoints.
 */

const {
  evaluateReadiness,
  generateMemorandum,
  reviewMemorandum,
  VersioningEngine,
  toHtml
} = require('../../lib/investment-intelligence');

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

async function investmentIntelligenceRouter(req, res, path, supabase, user) {
  try {
    if (path === '/investment-intelligence/engines' && req.method === 'GET') {
      return sendJson(res, 200, {
        engines: [
          { code: 'investment_readiness', name: 'Investment Readiness Engine' },
          { code: 'investment_memorandum', name: 'Investment Memorandum Engine' },
          { code: 'investment_story', name: 'Investment Story Engine' },
          { code: 'ai_investment_review', name: 'AI Investment Review Engine' },
          { code: 'versioning', name: 'Versioning Engine' },
          { code: 'document_generator', name: 'Document Generator (HTML)' }
        ]
      });
    }

    const readinessMatch = path.match(/^\/investment-intelligence\/readiness\/([^/]+)$/);
    if (readinessMatch && req.method === 'GET') {
      const projectId = readinessMatch[1];
      const result = await evaluateReadiness({ projectId, supabase });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.searchParams.get('persist') !== 'false') {
        await supabase.from('investment_readiness_scores').insert({
          project_id: projectId,
          user_id: user.id,
          readiness_score: result.output.readinessScore,
          grade: result.output.grade,
          strengths: result.output.strengths,
          weaknesses: result.output.weaknesses,
          missing_items: result.output.missingItems,
          action_plan: result.output.actionPlan
        });
      }
      return sendJson(res, 200, result);
    }

    if (path === '/investment-intelligence/memorandum' && req.method === 'POST') {
      const body = await parseBody(req);
      const { projectId, language, currency, type, useAi } = body;
      if (!projectId) return sendJson(res, 400, { error: 'projectId is required' });

      const generated = await generateMemorandum({
        projectId,
        supabase,
        options: { language, currency, type, useAi, userId: user.id }
      });

      const { data: saved, error } = await supabase
        .from('investment_memoranda')
        .insert({
          project_id: projectId,
          user_id: user.id,
          type: type || 'investment_memorandum',
          language: language || 'ar',
          currency: currency || 'SAR',
          title: generated.output.title,
          content: generated.output,
          evidence_bundle: generated.evidence,
          confidence_score: generated.confidence
        })
        .select()
        .single();
      if (error) throw error;

      const versioning = new VersioningEngine(supabase);
      await versioning.createVersion(saved.id, generated.output, generated.evidence, generated.confidence, user.id, 'Initial generation');

      return sendJson(res, 201, { memorandum: saved, generated });
    }

    const memorandumIdMatch = path.match(/^\/investment-intelligence\/memorandum\/([^/]+)$/);
    if (memorandumIdMatch && req.method === 'GET') {
      const id = memorandumIdMatch[1];
      const { data, error } = await supabase.from('investment_memoranda').select('*').eq('id', id).single();
      if (error || !data) return sendJson(res, 404, { error: 'Memorandum not found' });
      return sendJson(res, 200, { memorandum: data });
    }

    const htmlMatch = path.match(/^\/investment-intelligence\/memorandum\/([^/]+)\/html$/);
    if (htmlMatch && req.method === 'GET') {
      const id = htmlMatch[1];
      const { data, error } = await supabase.from('investment_memoranda').select('*').eq('id', id).single();
      if (error || !data) return sendJson(res, 404, { error: 'Memorandum not found' });
      const html = toHtml(data);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(html);
    }

    const reviewMatch = path.match(/^\/investment-intelligence\/memorandum\/([^/]+)\/review$/);
    if (reviewMatch && req.method === 'POST') {
      const id = reviewMatch[1];
      const { data: memo, error } = await supabase.from('investment_memoranda').select('*').eq('id', id).single();
      if (error || !memo) return sendJson(res, 404, { error: 'Memorandum not found' });

      const review = await reviewMemorandum(memo, { userId: user.id });

      const { data: savedReview, error: reviewError } = await supabase
        .from('ai_investment_reviews')
        .insert({
          memorandum_id: id,
          project_id: memo.project_id,
          verdict: review.output.verdict,
          convincing: review.output.convincing,
          has_conflicts: review.output.hasConflicts,
          has_gaps: review.output.hasGaps,
          has_exaggeration: review.output.hasExaggeration,
          numbers_reasonable: review.output.numbersReasonable,
          risks_mentioned: review.output.risksMentioned,
          language_appropriate: review.output.languageAppropriate,
          issues: review.output.issues,
          suggestions: review.output.suggestions,
          confidence_score: review.confidence
        })
        .select()
        .single();
      if (reviewError) throw reviewError;

      await supabase.from('investment_memoranda').update({ ai_review_id: savedReview.id, status: review.output.verdict === 'approved' ? 'reviewed' : 'draft' }).eq('id', id);

      return sendJson(res, 200, { review: savedReview, result: review });
    }

    const versionsMatch = path.match(/^\/investment-intelligence\/memorandum\/([^/]+)\/versions$/);
    if (versionsMatch && req.method === 'GET') {
      const id = versionsMatch[1];
      const versioning = new VersioningEngine(supabase);
      const versions = await versioning.listVersions(id);
      return sendJson(res, 200, { versions });
    }

    const versionCreateMatch = path.match(/^\/investment-intelligence\/memorandum\/([^/]+)\/version$/);
    if (versionCreateMatch && req.method === 'POST') {
      const id = versionCreateMatch[1];
      const body = await parseBody(req);
      const { data: memo, error } = await supabase.from('investment_memoranda').select('*').eq('id', id).single();
      if (error || !memo) return sendJson(res, 404, { error: 'Memorandum not found' });

      const versioning = new VersioningEngine(supabase);
      const result = await versioning.createVersion(id, memo.content, memo.evidence_bundle, memo.confidence_score, user.id, body.changeSummary || 'Manual version');
      return sendJson(res, 201, { version: result.version });
    }

    return sendJson(res, 404, { error: 'Investment Intelligence endpoint not found' });
  } catch (err) {
    console.error('[investment-intelligence]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

module.exports = { investmentIntelligenceRouter };
