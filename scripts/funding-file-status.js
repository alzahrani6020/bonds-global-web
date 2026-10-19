(function () {
  'use strict';

  const STATUS_LABELS = {
    ar: {
      not_started: 'لم يبدأ',
      draft: 'مسودة',
      submitted: 'مُرسل',
      reviewed: 'تمت المراجعة',
      under_review: 'قيد المراجعة',
      approved: 'معتمد',
      additional_information_required: 'مطلوب استكمال',
      rejected: 'مرفوض',
      revoked: 'ملغي',
      archived: 'مؤرشف',
      closed: 'مغلق',
      error: 'تعذر التحقق'
    },
    en: {
      not_started: 'Not started',
      draft: 'Draft',
      submitted: 'Submitted',
      reviewed: 'Reviewed',
      under_review: 'Under review',
      approved: 'Approved',
      additional_information_required: 'More information required',
      rejected: 'Rejected',
      revoked: 'Revoked',
      archived: 'Archived',
      closed: 'Closed',
      error: 'Unable to verify'
    }
  };

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function statusClass(status, complete) {
    if (complete) return 'is-complete';
    if (status === 'draft' || status === 'additional_information_required') return 'is-pending';
    if (status === 'not_started') return 'is-empty';
    if (status === 'error') return 'is-error';
    return 'is-neutral';
  }

  async function loadRegistry(sb) {
    const [{ data: stages, error: stagesError }, { data: requirements, error: requirementsError }] = await Promise.all([
      sb.from('funding_file_stages')
        .select('id,code,label_ar,label_en,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      sb.from('funding_file_requirements')
        .select('id,code,stage_id,label_ar,label_en,route_ar,route_en,sort_order,is_required,completion_statuses')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    ]);
    if (stagesError) throw stagesError;
    if (requirementsError) throw requirementsError;
    return { stages: stages || [], requirements: requirements || [] };
  }

  async function loadCaseSubmissions(sb, caseId) {
    if (!caseId) return [];
    const { data, error } = await sb
      .from('funding_case_submissions')
      .select('requirement_id,status,source_record_id,updated_at')
      .eq('case_id', caseId);
    if (error) throw error;
    return data || [];
  }

  function render(root, lang, registry, fundingCase, submissions) {
    const grid = root.querySelector('[data-funding-file-grid]');
    const summary = root.querySelector('[data-funding-file-summary]');
    const progress = root.querySelector('[data-funding-file-progress]');
    const action = root.querySelector('[data-funding-file-action]');
    if (!grid || !summary || !progress || !action) return;

    const submissionMap = new Map(submissions.map(row => [row.requirement_id, row]));
    const requirements = registry.requirements;
    let completed = 0;

    grid.innerHTML = registry.stages.map((stage, stageIndex) => {
      const items = requirements
        .filter(req => req.stage_id === stage.id)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

      if (!items.length) return '';

      const links = items.map(req => {
        const submission = submissionMap.get(req.id);
        const status = submission?.status || 'not_started';
        const complete = Array.isArray(req.completion_statuses) && req.completion_statuses.includes(status);
        if (complete) completed += 1;

        const baseRoute = lang === 'en' ? req.route_en : req.route_ar;
        const href = fundingCase
          ? window.BondsFundingCaseContext.withCase(baseRoute, fundingCase.id)
          : '#funding-request';
        const label = lang === 'en' ? req.label_en : req.label_ar;
        const badge = fundingCase
          ? '<span class="funding-file-status ' + statusClass(status, complete) + '">' +
              esc(STATUS_LABELS[lang][status] || status) + '</span>'
          : '';

        return '<a class="fi-btn fi-btn--secondary funding-file-link" href="' + esc(href) + '">' +
          '<span>' + esc(label) + (req.is_required ? '' : (lang === 'en' ? ' (Optional)' : ' (اختياري)')) + '</span>' +
          badge +
        '</a>';
      }).join('');

      const stageLabel = lang === 'en' ? stage.label_en : stage.label_ar;
      const stageNo = String(stageIndex + 1).padStart(2, '0');
      return '<div class="card reveal">' +
        '<div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:800;color:var(--gold-500);margin-bottom:var(--space-2);">' +
          (lang === 'en' ? 'STAGE ' : 'المرحلة ') + stageNo +
        '</div>' +
        '<h3 class="card__title">' + esc(stageLabel) + '</h3>' +
        '<div style="display:grid;gap:.65rem;margin-top:1.25rem;">' + links + '</div>' +
      '</div>';
    }).join('');

    if (fundingCase) {
      const required = requirements.filter(req => req.is_required);
      const requiredCompleted = required.filter(req => {
        const row = submissionMap.get(req.id);
        return row && Array.isArray(req.completion_statuses) && req.completion_statuses.includes(row.status);
      }).length;
      const total = required.length;
      const percent = total ? Math.round((requiredCompleted / total) * 100) : 0;
      summary.textContent = lang === 'en'
        ? requiredCompleted + ' of ' + total + ' required items completed — ' + fundingCase.case_reference
        : requiredCompleted + ' من ' + total + ' متطلبات أساسية مكتملة — ' + fundingCase.case_reference;
      progress.style.width = percent + '%';
      progress.setAttribute('aria-valuenow', String(percent));
      action.href = (lang === 'en' ? '/en/client/funding-case.html?id=' : '/client/funding-case.html?id=') + encodeURIComponent(fundingCase.id);
      action.textContent = lang === 'en' ? 'Back to Funding Case →' : 'العودة إلى حالة التمويل ←';
    } else {
      summary.textContent = lang === 'en'
        ? 'Create or open a funding case to track these requirements.'
        : 'أنشئ أو افتح حالة تمويل لتتبع هذه المتطلبات.';
      progress.style.width = '0%';
      progress.setAttribute('aria-valuenow', '0');
      action.href = '#funding-request';
      action.textContent = lang === 'en' ? 'Start a Funding Request →' : 'ابدأ طلب التمويل ←';
    }
  }

  function renderError(root, lang, message) {
    const grid = root.querySelector('[data-funding-file-grid]');
    const summary = root.querySelector('[data-funding-file-summary]');
    if (grid) grid.innerHTML = '';
    if (summary) summary.textContent = lang === 'en'
      ? 'Unable to load funding file requirements.'
      : 'تعذر تحميل متطلبات ملف التمويل.';
    console.warn('[funding-file]', message);
  }

  async function init() {
    const root = document.querySelector('[data-funding-file]');
    if (!root || !window.BondsAuth || !window.BondsFundingCaseContext) return;
    const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';

    try {
      await window.BondsAuth.ensureEnv();
      const sb = window.BondsAuth.getSupabase();
      if (!sb) throw new Error('Supabase client unavailable');

      const registry = await loadRegistry(sb);
      const userResult = await window.BondsAuth.getUser();
      const user = userResult?.data?.user || null;
      let fundingCase = null;
      let submissions = [];

      if (window.BondsFundingCaseContext.getCaseId()) {
        if (!user) {
          const authPath = lang === 'en' ? '/en/calculators/auth/index.html' : '/calculators/auth/index.html';
          location.href = authPath + '?redirect=' + encodeURIComponent(location.pathname + location.search + location.hash);
          return;
        }
        fundingCase = await window.BondsFundingCaseContext.resolve(sb, user);
        submissions = await loadCaseSubmissions(sb, fundingCase.id);
      }

      render(root, lang, registry, fundingCase, submissions);
    } catch (error) {
      renderError(root, lang, error?.message || error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
