/**
 * Shared AI Analyze client for admin modules.
 * Calls /api/v3/ai/analyze using the current Supabase session token.
 */
(function (global) {
  'use strict';

  async function getSupabaseClient() {
    let client = null;
    if (window.BondsAuth && typeof window.BondsAuth.getSupabase === 'function') {
      client = window.BondsAuth.getSupabase();
    } else if (window.AiAdvisorService && typeof window.AiAdvisorService.getSb === 'function') {
      client = window.AiAdvisorService.getSb();
    } else if (typeof window.createBondsSupabaseClient === 'function') {
      client = window.createBondsSupabaseClient();
    } else if (window.supabase && window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
      client = window.supabase.createClient(window.__ENV.SUPABASE_URL, window.__ENV.SUPABASE_ANON_KEY);
    }
    return client;
  }

  async function getSessionToken() {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Supabase غير مهيأ');
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) throw new Error('يجب تسجيل الدخول');
    return session.access_token;
  }

  async function analyze({ type, payload, model }) {
    const token = await getSessionToken();
    const res = await fetch('/api/v3/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, payload, model }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = err.error || err.message || JSON.stringify(err);
      } catch (e) {
        detail = await res.text();
      }
      throw new Error(`فشل التحليل (${res.status}): ${detail}`);
    }

    return res.json();
  }

  function renderResult(result) {
    if (!result || typeof result !== 'object') return '<p>لا توجد نتيجة</p>';
    const exec = result.executive_summary ? `<p class="ai-result-summary">${BondsAdminCommon.escapeHtml(result.executive_summary)}</p>` : '';
    const analysis = result.analysis ? `<div class="ai-result-section"><h4>التحليل</h4><p>${BondsAdminCommon.escapeHtml(result.analysis)}</p></div>` : '';
    const risk = result.risk_level ? `<div class="ai-result-badge ai-result-badge--${riskClass(result.risk_level)}">${BondsAdminCommon.escapeHtml(result.risk_level)} ${result.risk_score !== undefined ? `(${result.risk_score})` : ''}</div>` : '';
    const recs = Array.isArray(result.recommendations)
      ? `<div class="ai-result-section"><h4>التوصيات</h4><ul>${result.recommendations.map(r => `<li>${BondsAdminCommon.escapeHtml(r)}</li>`).join('')}</ul></div>`
      : '';
    const strengths = Array.isArray(result.strengths)
      ? `<div class="ai-result-section"><h4>نقاط القوة</h4><ul>${result.strengths.map(s => `<li>${BondsAdminCommon.escapeHtml(s)}</li>`).join('')}</ul></div>`
      : '';
    const weaknesses = Array.isArray(result.weaknesses)
      ? `<div class="ai-result-section"><h4>نقاط الضعف</h4><ul>${result.weaknesses.map(w => `<li>${BondsAdminCommon.escapeHtml(w)}</li>`).join('')}</ul></div>`
      : '';
    const missing = Array.isArray(result.missing_data) && result.missing_data.length
      ? `<div class="ai-result-section"><h4>بيانات ناقصة</h4><ul>${result.missing_data.map(m => `<li>${BondsAdminCommon.escapeHtml(m)}</li>`).join('')}</ul></div>`
      : '';
    const metrics = result.financial_summary && Array.isArray(result.financial_summary.key_metrics)
      ? `<div class="ai-result-section"><h4>المؤشرات المالية</h4><div class="ai-result-metrics">${result.financial_summary.key_metrics.map(m => `
          <div class="ai-result-metric">
            <div class="ai-result-metric__name">${BondsAdminCommon.escapeHtml(m.name)}</div>
            <div class="ai-result-metric__value">${BondsAdminCommon.escapeHtml(String(m.value ?? '—'))}</div>
            <div class="ai-result-metric__source">${BondsAdminCommon.escapeHtml(m.source || '')} ${m.confidence !== undefined ? `· ثقة ${m.confidence}%` : ''}</div>
          </div>`).join('')}</div></div>`
      : '';

    return `
      <div class="ai-result">
        ${risk}
        ${exec}
        ${analysis}
        ${metrics}
        ${strengths}
        ${weaknesses}
        ${recs}
        ${missing}
      </div>`;
  }

  function riskClass(level) {
    const text = String(level).toLowerCase();
    if (text.includes('حرج') || text.includes('high') || text.includes('critical')) return 'danger';
    if (text.includes('مرتفع') || text.includes('medium')) return 'warning';
    if (text.includes('متوسط') || text.includes('low')) return 'success';
    return 'neutral';
  }

  global.AiAnalyzeService = {
    analyze,
    getSessionToken,
    renderResult,
  };
})(window);
