/**
 * Bonds Admin i18n state.
 * Central locale/direction contract shared by the admin shell and embedded modules.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'bonds-admin-locale';
  const SUPPORTED = new Set(['ar', 'en']);

  const dictionary = {
    ar: {
      refresh: 'تحديث',
      loading: 'جارِ التحميل...',
      loadFailed: 'فشل التحميل',
      partialData: 'بعض مصادر البيانات غير متاحة',
      noData: 'لا توجد بيانات',
      executiveAnalytics: 'التحليلات التنفيذية والذكاء الاصطناعي',
      executiveSubtitle: 'الإيرادات · الاحتفاظ · مسار التحويل · خط المبيعات · التجديدات · صحة العملاء · تكلفة وزمن الذكاء الاصطناعي',
      executiveKpis: 'المؤشرات التنفيذية',
      funnel: 'مسار التحويل',
      aiOperations: 'عمليات الذكاء الاصطناعي',
      cohorts: 'مجموعات العملاء',
      aiModelsFeatures: 'نماذج وخصائص الذكاء الاصطناعي',
      aiControls: 'ضوابط الذكاء الاصطناعي',
      month: 'الشهر',
      registered: 'المسجلون',
      active30d: 'النشطون 30 يومًا',
      retention: 'الاحتفاظ',
      paid: 'المدفوع',
      conversion: 'التحويل',
      requests: 'الطلبات',
      costUsd: 'التكلفة بالدولار',
      failureRate: 'معدل الفشل',
      inputTokens: 'رموز الإدخال',
      outputTokens: 'رموز الإخراج',
      pipeline: 'خط المبيعات',
      weightedPipeline: 'خط المبيعات المرجّح',
      renewalRisk: 'مخاطر التجديد',
      customerHealth: 'صحة العملاء',
      activated: 'المفعّلون',
      models: 'النماذج',
      features: 'الخصائص',
      killSwitch: 'مفتاح الإيقاف',
      feature: 'الخاصية',
      disable: 'تعطيل',
      enable: 'تفعيل',
      reason: 'السبب',
      apply: 'تطبيق',
      promptVersion: 'إصدار الموجّه',
      promptKey: 'مفتاح الموجّه',
      promptContent: 'محتوى الموجّه',
      createDraft: 'إنشاء نسخة مسودة',
      currentKillSwitches: 'حالة مفاتيح الإيقاف',
      promptVersions: 'إصدارات الموجّهات',
      unknownNoTelemetry: 'غير معروف — لا توجد بيانات تشغيل للذكاء الاصطناعي بعد',
      noCohorts: 'لا توجد مجموعات عملاء',
      requestId: 'معرّف الطلب'
    },
    en: {
      refresh: 'Refresh',
      loading: 'Loading...',
      loadFailed: 'Load failed',
      partialData: 'Some data sources are unavailable',
      noData: 'No data',
      executiveAnalytics: 'Executive & AI Analytics',
      executiveSubtitle: 'Revenue · Retention · Funnel · Pipeline · Renewals · Customer Health · AI Cost/Latency',
      executiveKpis: 'Executive KPIs',
      funnel: 'Funnel',
      aiOperations: 'AI Operations',
      cohorts: 'Cohorts',
      aiModelsFeatures: 'AI Models / Features',
      aiControls: 'AI Controls',
      month: 'Month',
      registered: 'Registered',
      active30d: 'Active 30d',
      retention: 'Retention',
      paid: 'Paid',
      conversion: 'Conversion',
      requests: 'Requests',
      costUsd: 'Cost USD',
      failureRate: 'Failure Rate',
      inputTokens: 'Input Tokens',
      outputTokens: 'Output Tokens',
      pipeline: 'Pipeline',
      weightedPipeline: 'Weighted Pipeline',
      renewalRisk: 'Renewal Risk',
      customerHealth: 'Customer Health',
      activated: 'Activated',
      models: 'Models',
      features: 'Features',
      killSwitch: 'Kill Switch',
      feature: 'Feature',
      disable: 'Disable',
      enable: 'Enable',
      reason: 'Reason',
      apply: 'Apply',
      promptVersion: 'Prompt Version',
      promptKey: 'Prompt key',
      promptContent: 'Prompt content',
      createDraft: 'Create Draft Version',
      currentKillSwitches: 'Current Kill Switches',
      promptVersions: 'Prompt Versions',
      unknownNoTelemetry: 'UNKNOWN — no AI telemetry yet',
      noCohorts: 'No cohorts',
      requestId: 'Request ID'
    }
  };

  function normalize(value) {
    const lang = String(value || '').toLowerCase().split('-')[0];
    return SUPPORTED.has(lang) ? lang : 'ar';
  }

  function readStored() {
    try { return normalize(global.localStorage?.getItem(STORAGE_KEY) || 'ar'); }
    catch (_) { return 'ar'; }
  }

  let locale = readStored();

  function t(key) {
    return dictionary[locale]?.[key] || dictionary.ar[key] || key;
  }

  function bind(root) {
    const scope = root || document;
    scope.querySelectorAll?.('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll?.('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll?.('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
  }

  function apply(next, options = {}) {
    locale = normalize(next);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    if (options.persist !== false) {
      try { global.localStorage?.setItem(STORAGE_KEY, locale); } catch (_) {}
    }
    bind(document);
    global.dispatchEvent(new CustomEvent('admin-locale-changed', { detail: { locale } }));
    return locale;
  }

  function formatNumber(value, options = {}) {
    const number = Number(value || 0);
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', options).format(number);
  }

  function formatCurrency(value, currency = 'SAR', options = {}) {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: 2, ...options
    }).format(Number(value || 0));
  }

  global.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    if (event.data?.type !== 'admin-locale') return;
    apply(event.data.locale, { persist: true });
  });

  global.BondsAdminI18n = {
    get locale() { return locale; },
    setLocale: apply,
    t,
    bind,
    formatNumber,
    formatCurrency,
    supported: ['ar', 'en']
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(locale, { persist: false }), { once: true });
  } else {
    apply(locale, { persist: false });
  }
})(window);
