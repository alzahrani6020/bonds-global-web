/**
 * BONDS AI Valuation Analyst Handler
 *
 * POST /api/v3/ai/valuate
 * Body: { asset_valuation_id }
 *
 * 1. Verifies the user owns the valuation record.
 * 2. Loads sector knowledge base.
 * 3. Calls OpenAI via lib/ai/orchestrator for narrative only.
 * 4. Saves the report as a new version in valuation_ai_reports.
 */

const { getUserFromToken } = require('../../v3/lib/auth');
const getSupabase = require('../api/supabase');
const { analyze } = require('./orchestrator');
const { get: getKnowledge } = require('../../valuation/valuation-knowledge-base');

const AI_VERSION = '1.0.0';

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

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

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n) {
  const num = safeNumber(n);
  return num.toLocaleString('ar-SA', { maximumFractionDigits: 2 });
}

function buildValuationPayload(valuation, knowledge) {
  const inputs = valuation.valuation_inputs || {};
  const results = valuation.results || {};
  const market = valuation.market_data_snapshot || {};
  const condition = valuation.condition_snapshot || {};
  const risk = valuation.risk_snapshot || {};
  const eco = valuation.economic_life_snapshot || {};
  const dep = valuation.depreciation_snapshot || {};

  const presentValueKeys = [
    'book_value', 'market_value', 'fair_value', 'investment_value',
    'liquidation_value', 'replacement_value', 'insurance_value',
    'operating_value', 'quick_exit_value', 'restructured_value',
    'enterprise_value', 'goodwill_value'
  ];

  const methodsUsed = [];
  if (results.book_value !== undefined) methodsUsed.push('Cost Approach');
  if (results.market_value !== undefined) methodsUsed.push('Market Approach');
  if (results.investment_value !== undefined || results.enterprise_value !== undefined) methodsUsed.push('Income Approach');
  if (results.replacement_value !== undefined) methodsUsed.push('Replacement Cost');
  if (results.liquidation_value !== undefined) methodsUsed.push('Liquidation Analysis');
  if (results.fair_value !== undefined) methodsUsed.push('Comparable Sales / Asset Based');

  return {
    asset_class: valuation.asset_class,
    asset_name: valuation.asset_name,
    asset_identifier: valuation.asset_identifier,
    country: inputs.country,
    city: inputs.city,
    valuation_values: {
      book_value: results.book_value,
      market_value: results.market_value,
      fair_value: results.fair_value,
      investment_value: results.investment_value,
      liquidation_value: results.liquidation_value,
      replacement_value: results.replacement_value,
      insurance_value: results.insurance_value,
      operating_value: results.operating_value,
      quick_exit_value: results.quick_exit_value,
      restructured_value: results.restructured_value,
      enterprise_value: results.enterprise_value,
      goodwill_value: results.goodwill_value
    },
    methodologies_used: methodsUsed,
    quality_scores: {
      confidence_score: safeNumber(valuation.confidence_score),
      data_quality_score: safeNumber(valuation.data_quality_score)
    },
    market_data: market,
    condition_assessment: condition,
    risk_assessment: risk,
    economic_life: eco,
    depreciation: dep,
    sector_knowledge: knowledge || {},
    data_sources_confidence: [
      { source: 'Valuation Engine', score: safeNumber(valuation.confidence_score), notes: 'القيم المالية المحسوبة من محرك التقييم' },
      { source: 'Market Intelligence', score: safeNumber(market.data_quality_score || market.confidence || 0), notes: 'بيانات السوق والمقارنات' },
      { source: 'Condition Assessment', score: safeNumber(condition.confidence_score), notes: 'درجة حالة الأصل' },
      { source: 'Risk Intelligence', score: safeNumber(risk.confidence_score), notes: 'تقييم المخاطر' }
    ].filter(s => s.score > 0)
  };
}

function generateReportHtml(result, assetName) {
  if (!result || typeof result !== 'object') return '';

  const decisionClass = {
    'ممتاز للاستثمار': 'decision-excellent',
    'مناسب للاستثمار': 'decision-good',
    'مناسب بشروط': 'decision-conditional',
    'يحتاج إعادة تطوير': 'decision-redevelop',
    'يحتاج إعادة هيكلة': 'decision-restructure',
    'يحتاج دراسة إضافية': 'decision-study',
    'عالي المخاطر': 'decision-high-risk',
    'غير موصى به حالياً': 'decision-not-recommended'
  }[result.final_decision] || 'decision-neutral';

  const list = (items) => {
    if (!Array.isArray(items) || !items.length) return '<li>لا يوجد</li>';
    return items.map(i => `<li>${String(i).replace(/</g, '&lt;')}</li>`).join('');
  };

  const forecast = result.future_forecast || {};

  return `
    <div class="ai-valuation-report">
      <div class="ai-report-header">
        <h2>تقرير التقييم الذكي — ${assetName || 'الأصل'}</h2>
        <div class="ai-report-decision ${decisionClass}">${result.final_decision || '—'}</div>
      </div>

      <section class="ai-report-section">
        <h3>الملخص التنفيذي</h3>
        <p>${result.executive_summary || '—'}</p>
      </section>

      <section class="ai-report-section ai-report-grid">
        <div>
          <h4>سبب ارتفاع القيمة</h4>
          <ul>${list(result.reasons_for_high_value)}</ul>
        </div>
        <div>
          <h4>سبب انخفاض القيمة</h4>
          <ul>${list(result.reasons_for_low_value)}</ul>
        </div>
      </section>

      <section class="ai-report-section ai-report-grid">
        <div>
          <h4>أفضل فرص التطوير</h4>
          <ul>${list(result.best_development_opportunities)}</ul>
        </div>
        <div>
          <h4>أفضل فرص الاستثمار</h4>
          <ul>${list(result.best_investment_opportunities)}</ul>
        </div>
      </section>

      <section class="ai-report-section ai-report-grid">
        <div>
          <h4>أفضل وقت للبيع</h4>
          <p>${result.best_time_to_sell || '—'}</p>
        </div>
        <div>
          <h4>أفضل وقت للشراء</h4>
          <p>${result.best_time_to_buy || '—'}</p>
        </div>
      </section>

      <section class="ai-report-section">
        <h3>أفضل طريقة لزيادة القيمة</h3>
        <p>${result.best_way_to_increase_value || '—'}</p>
      </section>

      <section class="ai-report-section">
        <h3>تحليل SWOT</h3>
        <div class="ai-report-grid">
          <div><h4>نقاط القوة</h4><ul>${list(result.strengths)}</ul></div>
          <div><h4>نقاط الضعف</h4><ul>${list(result.weaknesses)}</ul></div>
          <div><h4>الفرص</h4><ul>${list(result.opportunities)}</ul></div>
          <div><h4>التهديدات</h4><ul>${list(result.threats)}</ul></div>
        </div>
      </section>

      <section class="ai-report-section">
        <h3>التوصيات</h3>
        <ul>${list(result.recommendations)}</ul>
      </section>

      <section class="ai-report-section">
        <h3>التوقعات المستقبلية</h3>
        <div class="ai-report-grid">
          <div><strong>بعد سنة:</strong> ${formatCurrency(forecast.value_after_1y)}</div>
          <div><strong>بعد 3 سنوات:</strong> ${formatCurrency(forecast.value_after_3y)}</div>
          <div><strong>بعد 5 سنوات:</strong> ${formatCurrency(forecast.value_after_5y)}</div>
          <div><strong>أفضل وقت للتطوير:</strong> ${forecast.best_time_to_develop || '—'}</div>
          <div><strong>أفضل وقت للتخارج:</strong> ${forecast.best_time_to_exit || '—'}</div>
        </div>
      </section>

      <section class="ai-report-section">
        <h3>قرار BONDS</h3>
        <p><strong>${result.final_decision || '—'}</strong></p>
        <p>${result.decision_reason || '—'}</p>
      </section>

      <section class="ai-report-footer">
        <p>درجة الثقة: ${safeNumber(result.confidence)}% | هذا التقرير صادر عن BONDS AI Valuation Analyst ولا يغني عن التقييم المعتمد.</p>
      </section>
    </div>
  `;
}

async function getNextVersion(supabase, assetValuationId) {
  const { data, error } = await supabase
    .from('valuation_ai_reports')
    .select('version')
    .eq('asset_valuation_id', assetValuationId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 1;
  return (data.version || 0) + 1;
}

async function handleValuationAnalyze(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { asset_valuation_id } = body;
  if (!asset_valuation_id) {
    return sendJson(res, 400, { error: 'asset_valuation_id is required' });
  }

  const supabase = getSupabase();

  // Verify ownership
  const { data: valuation, error: valuationError } = await supabase
    .from('asset_valuations')
    .select('*')
    .eq('id', asset_valuation_id)
    .or(`user_id.eq.${user.id},user_id.in.(SELECT user_id FROM public.user_roles WHERE role in ('admin','editor'))`)
    .single();

  if (valuationError || !valuation) {
    console.error('[ai/valuate] valuation fetch error:', valuationError?.message);
    return sendJson(res, 404, { error: 'Valuation record not found or access denied' });
  }

  const minConfidence = 80;
  const minDataQuality = 80;
  if (safeNumber(valuation.confidence_score) < minConfidence || safeNumber(valuation.data_quality_score) < minDataQuality) {
    return sendJson(res, 400, {
      error: 'Valuation quality scores are too low for an AI report. Run Validate Data first and resolve missing fields.',
      error_ar: 'درجات جودة التقييم منخفضة لتوليد تقرير ذكي. نفّذ التحقق من البيانات وحل الحقول الناقصة أولاً.',
      confidence_score: safeNumber(valuation.confidence_score),
      data_quality_score: safeNumber(valuation.data_quality_score)
    });
  }

  const knowledge = getKnowledge(valuation.asset_class);
  const payload = buildValuationPayload(valuation, knowledge);

  let analysisResult;
  try {
    analysisResult = await analyze({
      userId: user.id,
      type: 'asset_valuation',
      payload
    });
  } catch (err) {
    console.error('[ai/valuate] analyze error:', err.message);
    return sendJson(res, 500, { error: err.message });
  }

  let aiOutput = analysisResult.result;
  if (typeof aiOutput === 'string') {
    try {
      aiOutput = JSON.parse(aiOutput);
    } catch (err) {
      console.warn('[ai/valuate] Could not parse AI output as JSON');
    }
  }

  const confidenceScore = safeNumber(aiOutput.confidence);
  const nextVersion = await getNextVersion(supabase, asset_valuation_id);
  const contentHtml = generateReportHtml(aiOutput, valuation.asset_name);

  const reportPayload = {
    asset_valuation_id,
    user_id: user.id,
    client_id: valuation.client_id,
    version: nextVersion,
    ai_version: AI_VERSION,
    confidence_score: confidenceScore,
    executive_summary: aiOutput.executive_summary || null,
    strengths: Array.isArray(aiOutput.strengths) ? aiOutput.strengths : [],
    weaknesses: Array.isArray(aiOutput.weaknesses) ? aiOutput.weaknesses : [],
    opportunities: Array.isArray(aiOutput.opportunities) ? aiOutput.opportunities : [],
    threats: Array.isArray(aiOutput.threats) ? aiOutput.threats : [],
    recommendations: Array.isArray(aiOutput.recommendations) ? aiOutput.recommendations : [],
    future_forecast: aiOutput.future_forecast || {},
    final_decision: aiOutput.final_decision || null,
    decision_reason: aiOutput.decision_reason || null,
    content_html: contentHtml,
    summary: aiOutput,
    model: analysisResult.model || null,
    tokens_input: analysisResult.tokensInput || 0,
    tokens_output: analysisResult.tokensOutput || 0,
    cost_usd: analysisResult.costUsd || 0,
    status: 'draft',
    created_by: user.id
  };

  const { data: report, error: insertError } = await supabase
    .from('valuation_ai_reports')
    .insert(reportPayload)
    .select('id, version, created_at')
    .single();

  if (insertError) {
    console.error('[ai/valuate] insert error:', insertError.message);
    return sendJson(res, 500, { error: insertError.message });
  }

  sendJson(res, 200, {
    success: true,
    report_id: report.id,
    version: report.version,
    created_at: report.created_at,
    cached: analysisResult.cached,
    confidence_score: confidenceScore,
    content_html: contentHtml,
    result: aiOutput,
    usage: analysisResult.cached
      ? { cached: true, cost_usd: 0 }
      : {
          tokens_input: analysisResult.tokensInput,
          tokens_output: analysisResult.tokensOutput,
          cost_usd: analysisResult.costUsd
        }
  });
}

module.exports = { handleValuationAnalyze };
