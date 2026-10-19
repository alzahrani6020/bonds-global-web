(function () {
  'use strict';

  const COMPLETE_STATUSES = new Set(['submitted', 'reviewed', 'under_review', 'approved']);
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

  const ITEMS = [
    { key: 'kyc', table: 'client_kyc_cases' },
    { key: 'establishment', table: 'client_establishment_profiles' },
    { key: 'activity', table: 'client_business_activity_profiles' },
    { key: 'cash_flow', table: 'client_cash_flow_reports' },
    { key: 'receivables', table: 'client_receivables_aging_reports' },
    { key: 'payables', table: 'client_payables_aging_reports' },
    { key: 'credit_business', table: 'client_credit_consents', subjectType: 'business' },
    { key: 'credit_individual', table: 'client_credit_consents', subjectType: 'individual' }
  ];

  function normalizeStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return status || 'not_started';
  }

  function statusClass(status) {
    if (COMPLETE_STATUSES.has(status)) return 'is-complete';
    if (status === 'draft' || status === 'additional_information_required') return 'is-pending';
    if (status === 'not_started') return 'is-empty';
    if (status === 'error') return 'is-error';
    return 'is-neutral';
  }

  async function loadLatestStatus(sb, userId, item) {
    let query = sb
      .from(item.table)
      .select('status,updated_at')
      .eq('user_id', userId);

    if (item.subjectType) query = query.eq('subject_type', item.subjectType);

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return normalizeStatus(data?.status);
  }

  function renderItem(root, lang, key, status) {
    const link = root.querySelector('[data-funding-file-item="' + key + '"]');
    if (!link) return;
    const badge = link.querySelector('[data-funding-file-status]');
    if (!badge) return;
    badge.textContent = STATUS_LABELS[lang][status] || status;
    badge.className = 'funding-file-status ' + statusClass(status);
  }

  function renderSummary(root, lang, statuses, signedIn) {
    const summary = root.querySelector('[data-funding-file-summary]');
    const progress = root.querySelector('[data-funding-file-progress]');
    if (!summary || !progress) return;

    if (!signedIn) {
      summary.textContent = lang === 'ar'
        ? 'سجّل الدخول لعرض حالة اكتمال ملفك التمويلي.'
        : 'Sign in to view your funding file completion status.';
      progress.style.width = '0%';
      return;
    }

    const completed = statuses.filter(status => COMPLETE_STATUSES.has(status)).length;
    const percent = Math.round((completed / ITEMS.length) * 100);
    summary.textContent = lang === 'ar'
      ? completed + ' من ' + ITEMS.length + ' نماذج مكتملة'
      : completed + ' of ' + ITEMS.length + ' forms completed';
    progress.style.width = percent + '%';
    progress.setAttribute('aria-valuenow', String(percent));
  }

  async function init() {
    const root = document.querySelector('[data-funding-file]');
    if (!root || !window.BondsAuth) return;

    const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    try {
      await window.BondsAuth.ensureEnv();
      const userResult = await window.BondsAuth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        ITEMS.forEach(item => renderItem(root, lang, item.key, 'not_started'));
        renderSummary(root, lang, [], false);
        return;
      }

      const sb = window.BondsAuth.getSupabase();
      if (!sb) throw new Error('Supabase client unavailable');

      const statuses = await Promise.all(ITEMS.map(async item => {
        try {
          const status = await loadLatestStatus(sb, user.id, item);
          renderItem(root, lang, item.key, status);
          return status;
        } catch (error) {
          console.warn('[funding-file-status]', item.key, error?.message || error);
          renderItem(root, lang, item.key, 'error');
          return 'error';
        }
      }));

      renderSummary(root, lang, statuses, true);
    } catch (error) {
      console.warn('[funding-file-status]', error?.message || error);
      ITEMS.forEach(item => renderItem(root, lang, item.key, 'error'));
      renderSummary(root, lang, [], false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
