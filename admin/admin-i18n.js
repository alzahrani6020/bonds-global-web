/**
 * Bonds Admin i18n state.
 * Single translation source for the admin shell and embedded modules.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'bonds-admin-locale';
  const SUPPORTED = new Set(['ar', 'en']);

  const dictionary = Object.freeze({
    ar: Object.freeze({
      refresh: 'تحديث',
      loading: 'جارِ التحميل...',
      loadFailed: 'فشل التحميل',
      partialData: 'بعض مصادر البيانات غير متاحة',
      noData: 'لا توجد بيانات',
      unknownLabel: 'مسمى غير معرّف',
      summary: 'الملخص',
      grossPaid: 'إجمالي المدفوع',
      events24h: 'الأحداث خلال 24 ساعة',
      flags: 'العلامات',
      entitlements: 'الاستحقاقات',
      proposal: 'العرض',
      'summary.grossPaid': 'إجمالي المدفوع',
      'summary.events24h': 'الأحداث خلال 24 ساعة',
      'pipeline.proposal.count': 'عدد العروض في خط المبيعات',
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
      requestId: 'معرّف الطلب',
      organizations: 'المنشآت',
      clients: 'العملاء',
      opportunities: 'الفرص',
      renewals: 'التجديدات',
      customerSuccessRecords: 'سجلات نجاح العملاء',
      generatedAt: 'وقت التحديث',
      currentDeployment: 'النشر الحالي',
      provider: 'المزوّد',
      environment: 'البيئة',
      production: 'الإنتاج',
      executive: 'التحليلات التنفيذية',
      activeUsers30d: 'المستخدمون النشطون خلال 30 يومًا',
      activatedUsers: 'المستخدمون المفعّلون',
      mrr: 'الإيراد الشهري المتكرر',
      arr: 'الإيراد السنوي المتكرر',
      arpu: 'متوسط الإيراد لكل مستخدم',
      conversionPct: 'معدل التحويل',
      churnPct: 'معدل التسرب',
      pipelineValue: 'قيمة خط المبيعات',
      lead: 'عملاء محتملون',
      qualified: 'مؤهلون',
      count: 'العدد',
      value: 'القيمة',
      weightedValue: 'القيمة المرجّحة',
      items: 'العناصر',
      status: 'الحالة',
      version: 'الإصدار',
      bondsUnifiedControlCenter: 'مركز التحكم الموحد لبوندز',
      dualCoreControlSurface: 'سطح التحكم ثنائي النواة',
      assistant: 'المساعد',
      learning: 'التعلم',
      training: 'التدريب',
      evolution: 'التطور',
      capabilities: 'القدرات',
      approvals: 'الموافقات',
      releases: 'الإصدارات',
      health: 'الصحة التشغيلية',
      audit: 'سجل المراجعة',
      adminControlCenter: 'مركز التحكم الإداري',
      platformOperations: 'عمليات المنصة',
      securityOperations: 'عمليات الأمن',
      productAutomation: 'المنتج والأتمتة',
      dataGovernanceDocuments: 'حوكمة البيانات والمستندات',
      cityIntelligence: 'ذكاء المدن',
      operationsQueue: 'طابور العمليات',
      slaBreaches: 'تجاوزات مستوى الخدمة',
      securityControls: 'ضوابط الأمن',
      configurationDrift: 'انحراف الإعدادات',
      adminSessionsDevices: 'جلسات وأجهزة الإدارة',
      openTasks: 'المهام المفتوحة',
      alerts: 'التنبيهات',
      paymentExceptions: 'استثناءات المدفوعات',
      securityExceptions: 'الاستثناءات الأمنية',
      liveSessions: 'الجلسات النشطة',
      configDrift: 'انحراف الإعدادات',
      revokeSession: 'إبطال الجلسة',
      accessPolicy: 'سياسة الوصول',
      trustDevice: 'اعتماد الجهاز',
      collection: 'التحصيل',
      contract: 'العقد',
      renewal: 'التجديد',
      userUuid: 'معرّف المستخدم',
      sessionId: 'معرّف الجلسة',
      policyName: 'اسم السياسة',
      disabled: 'معطل',
      enabled: 'مفعّل',
      allowedCountriesSaAe: 'الدول المسموح بها: SA,AE',
      deniedCountries: 'الدول المحظورة',
      allowedIpsCommaSeparated: 'عناوين IP المسموح بها مفصولة بفاصلة',
      requireTrustedDevice: 'اشتراط جهاز موثوق',
      maxSessionMinutes: 'الحد الأقصى للجلسة بالدقائق',
      deviceFingerprint: 'بصمة الجهاز',
      label: 'التسمية',
      organizationUuid: 'معرّف المنشأة',
      title: 'العنوان',
      normalEmergencyFullStop: 'عادي / طوارئ / إيقاف كامل',
      selfTraining: 'التدريب الذاتي',
      productionSha: 'معرّف إصدار الإنتاج',
      productionReady: 'الإنتاج جاهز',
      productionReadiness: 'جاهزية الإنتاج',
      aiApi: 'الذكاء الاصطناعي / واجهة البرمجة',
      ai: 'الذكاء الاصطناعي',
      crm: 'إدارة علاقات العملاء',
      dualCore: 'ثنائي النواة',
      controlCenter: 'مركز التحكم',
      'dashboard.pageTitle': 'لوحة التحكم الموحدة',
      'dashboard.search': 'بحث',
      'dashboard.notifications': 'الإشعارات',
      'dashboard.loadingSection': 'جارِ تحميل القسم...',
      'dashboard.searchPlaceholder': 'ابحث في الوحدات والصفحات...',
      'dashboard.switchLanguage': 'التبديل إلى الإنجليزية',
      'dashboard.group.overview': 'نظرة عامة',
      'dashboard.group.customersBusiness': 'العملاء والأعمال',
      'dashboard.group.finance': 'المالية',
      'dashboard.group.intelligenceData': 'الذكاء والبيانات',
      'dashboard.group.operations': 'التشغيل',
      'dashboard.group.securityGovernance': 'الأمن والحوكمة',
      'dashboard.nav.overview': 'نظرة عامة',
      'dashboard.nav.executiveDashboard': 'المؤشرات التنفيذية',
      'dashboard.nav.executiveAiAnalytics': 'التحليلات التنفيذية والذكاء الاصطناعي',
      'dashboard.nav.analytics': 'التحليلات',
      'dashboard.nav.onlineUsers': 'المتواجدون الآن',
      'dashboard.nav.globalSearch': 'البحث الموحد',
      'dashboard.nav.users': 'المستخدمون',
      'dashboard.nav.messages': 'الرسائل',
      'dashboard.nav.agentInbox': 'صندوق عمل المساعد',
      'dashboard.nav.humanApprovals': 'الموافقات البشرية',
      'dashboard.nav.support': 'مركز الدعم',
      'dashboard.nav.crm': 'إدارة علاقات العملاء',
      'dashboard.nav.fundingCases': 'طلبات التمويل',
      'dashboard.nav.financialAdvisory': 'الاستشارات المالية',
      'dashboard.nav.distressedRecovery': 'إنقاذ الأصول المتعثرة',
      'dashboard.nav.finance': 'العمليات المالية',
      'dashboard.nav.subscriptions': 'الاشتراكات',
      'dashboard.nav.bankTransfers': 'التحويلات البنكية',
      'dashboard.nav.conversionDashboard': 'تحويل الحاسبات',
      'dashboard.nav.cityIntelligence': 'ذكاء المدن',
      'dashboard.nav.dataCoverage': 'مصفوفة تغطية البيانات',
      'dashboard.nav.marketIntelligence': 'الذكاء السوقي',
      'dashboard.nav.dataQualityCenter': 'مركز جودة البيانات',
      'dashboard.nav.dataQuality': 'تقرير جودة البيانات',
      'dashboard.nav.dataGovernance': 'حوكمة البيانات والوثائق',
      'dashboard.nav.aiBusinessAdvisor': 'مستشار الأعمال الذكي',
      'dashboard.nav.aiReviews': 'مراجعات الذكاء الاصطناعي',
      'dashboard.nav.riskIntelligence': 'ذكاء المخاطر',
      'dashboard.nav.conditionAssessment': 'تقييم الحالة',
      'dashboard.nav.economicLife': 'العمر الاقتصادي للأصول',
      'dashboard.nav.depreciationFactors': 'عوامل الاستهلاك',
      'dashboard.nav.automation': 'الأتمتة والمنتج',
      'dashboard.nav.platformOperations': 'عمليات المنصة',
      'dashboard.nav.socialMedia': 'التواصل الاجتماعي',
      'dashboard.nav.exceptions': 'الاستثناءات',
      'dashboard.nav.settings': 'الإعدادات',
      'dashboard.nav.roles': 'الصلاحيات والأدوار',
      'dashboard.nav.security': 'الأمان والمصادقة الثنائية',
      'dashboard.nav.securityOperations': 'عمليات الأمن',
      'dashboard.nav.controlCenter': 'مركز التحكم الإداري',
      'dashboard.nav.auditLog': 'سجل المراجعة'
    }),
    en: Object.freeze({
      refresh: 'Refresh',
      loading: 'Loading...',
      loadFailed: 'Load failed',
      partialData: 'Some data sources are unavailable',
      noData: 'No data',
      unknownLabel: 'Unknown label',
      summary: 'Summary',
      grossPaid: 'Gross Paid',
      events24h: 'Events 24h',
      flags: 'Flags',
      entitlements: 'Entitlements',
      proposal: 'Proposal',
      'summary.grossPaid': 'Gross Paid',
      'summary.events24h': 'Events 24h',
      'pipeline.proposal.count': 'Pipeline Proposal Count',
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
      requestId: 'Request ID',
      organizations: 'Organizations',
      clients: 'Clients',
      opportunities: 'Opportunities',
      renewals: 'Renewals',
      customerSuccessRecords: 'Customer Success Records',
      generatedAt: 'Generated At',
      currentDeployment: 'Current Deployment',
      provider: 'Provider',
      environment: 'Environment',
      production: 'Production',
      executive: 'Executive Analytics',
      activeUsers30d: 'Active Users 30d',
      activatedUsers: 'Activated Users',
      mrr: 'MRR',
      arr: 'ARR',
      arpu: 'ARPU',
      conversionPct: 'Conversion %',
      churnPct: 'Churn %',
      pipelineValue: 'Pipeline Value',
      lead: 'Leads',
      qualified: 'Qualified',
      count: 'Count',
      value: 'Value',
      weightedValue: 'Weighted Value',
      items: 'Items',
      status: 'Status',
      version: 'Version',
      bondsUnifiedControlCenter: 'BONDS Unified Control Center',
      dualCoreControlSurface: 'Dual-Core Control Surface',
      assistant: 'Assistant',
      learning: 'Learning',
      training: 'Training',
      evolution: 'Evolution',
      capabilities: 'Capabilities',
      approvals: 'Approvals',
      releases: 'Releases',
      health: 'Health',
      audit: 'Audit',
      adminControlCenter: 'Admin Control Center',
      platformOperations: 'Platform Operations',
      securityOperations: 'Security Operations',
      productAutomation: 'Product & Automation',
      dataGovernanceDocuments: 'Data Governance & Documents',
      cityIntelligence: 'City Intelligence',
      operationsQueue: 'Operations Queue',
      slaBreaches: 'SLA Breaches',
      securityControls: 'Security Controls',
      configurationDrift: 'Configuration Drift',
      adminSessionsDevices: 'Admin Sessions / Devices',
      openTasks: 'Open Tasks',
      alerts: 'Alerts',
      paymentExceptions: 'Payment Exceptions',
      securityExceptions: 'Security Exceptions',
      liveSessions: 'Live Sessions',
      configDrift: 'Config Drift',
      revokeSession: 'Revoke Session',
      accessPolicy: 'Access Policy',
      trustDevice: 'Trust Device',
      collection: 'Collection',
      contract: 'Contract',
      renewal: 'Renewal',
      userUuid: 'User UUID',
      sessionId: 'Session ID',
      policyName: 'Policy name',
      disabled: 'Disabled',
      enabled: 'Enabled',
      allowedCountriesSaAe: 'Allowed countries: SA,AE',
      deniedCountries: 'Denied countries',
      allowedIpsCommaSeparated: 'Allowed IPs comma separated',
      requireTrustedDevice: 'Require trusted device',
      maxSessionMinutes: 'Max session minutes',
      deviceFingerprint: 'Device fingerprint',
      label: 'Label',
      organizationUuid: 'Organization UUID',
      title: 'Title',
      normalEmergencyFullStop: 'Normal / Emergency / Full Stop',
      selfTraining: 'Self-Training',
      productionSha: 'Production SHA',
      productionReady: 'Production READY',
      productionReadiness: 'Production readiness',
      aiApi: 'AI/API',
      ai: 'AI',
      crm: 'CRM',
      dualCore: 'Dual-Core',
      controlCenter: 'Control Center',
      'dashboard.pageTitle': 'Unified Admin Dashboard',
      'dashboard.search': 'Search',
      'dashboard.notifications': 'Notifications',
      'dashboard.loadingSection': 'Loading section...',
      'dashboard.searchPlaceholder': 'Search modules and pages...',
      'dashboard.switchLanguage': 'Switch to Arabic',
      'dashboard.group.overview': 'Overview',
      'dashboard.group.customersBusiness': 'Customers & Business',
      'dashboard.group.finance': 'Finance',
      'dashboard.group.intelligenceData': 'Intelligence & Data',
      'dashboard.group.operations': 'Operations',
      'dashboard.group.securityGovernance': 'Security & Governance',
      'dashboard.nav.overview': 'Overview',
      'dashboard.nav.executiveDashboard': 'Executive Dashboard',
      'dashboard.nav.executiveAiAnalytics': 'Executive & AI Analytics',
      'dashboard.nav.analytics': 'Analytics',
      'dashboard.nav.onlineUsers': 'Online Now',
      'dashboard.nav.globalSearch': 'Global Search',
      'dashboard.nav.users': 'Users',
      'dashboard.nav.messages': 'Messages',
      'dashboard.nav.agentInbox': 'Assistant Work Inbox',
      'dashboard.nav.humanApprovals': 'Human Approvals',
      'dashboard.nav.support': 'Support Center',
      'dashboard.nav.crm': 'CRM',
      'dashboard.nav.fundingCases': 'Funding Cases',
      'dashboard.nav.financialAdvisory': 'Financial Advisory',
      'dashboard.nav.distressedRecovery': 'Distressed Recovery',
      'dashboard.nav.finance': 'Finance Operations',
      'dashboard.nav.subscriptions': 'Subscriptions',
      'dashboard.nav.bankTransfers': 'Bank Transfers',
      'dashboard.nav.conversionDashboard': 'Calculator Conversion',
      'dashboard.nav.cityIntelligence': 'City Intelligence',
      'dashboard.nav.dataCoverage': 'Data Coverage Matrix',
      'dashboard.nav.marketIntelligence': 'Market Intelligence',
      'dashboard.nav.dataQualityCenter': 'Data Quality Center',
      'dashboard.nav.dataQuality': 'Data Quality Report',
      'dashboard.nav.dataGovernance': 'Data Governance & Documents',
      'dashboard.nav.aiBusinessAdvisor': 'AI Business Advisor',
      'dashboard.nav.aiReviews': 'AI Reviews',
      'dashboard.nav.riskIntelligence': 'Risk Intelligence',
      'dashboard.nav.conditionAssessment': 'Condition Assessment',
      'dashboard.nav.economicLife': 'Asset Economic Life',
      'dashboard.nav.depreciationFactors': 'Depreciation Factors',
      'dashboard.nav.automation': 'Automation & Product',
      'dashboard.nav.platformOperations': 'Platform Operations',
      'dashboard.nav.socialMedia': 'Social Media',
      'dashboard.nav.exceptions': 'Exceptions',
      'dashboard.nav.settings': 'Settings',
      'dashboard.nav.roles': 'Roles & Permissions',
      'dashboard.nav.security': 'Security & MFA',
      'dashboard.nav.securityOperations': 'Security Operations',
      'dashboard.nav.controlCenter': 'Admin Control Center',
      'dashboard.nav.auditLog': 'Audit Log'
    })
  });

  const missingKeys = new Set();

  function normalize(value) {
    const lang = String(value || '').toLowerCase().split('-')[0];
    return SUPPORTED.has(lang) ? lang : 'ar';
  }

  function readStored() {
    try { return normalize(global.localStorage?.getItem(STORAGE_KEY) || document.documentElement?.lang || 'ar'); }
    catch (_) { return normalize(document.documentElement?.lang || 'ar'); }
  }

  let locale = readStored();

  function toCamel(segment) {
    return String(segment || '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-\s]+(.)?/g, (_, ch) => ch ? ch.toUpperCase() : '')
      .replace(/^./, ch => ch.toLowerCase());
  }

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .split('.')
      .map(toCamel)
      .filter(Boolean)
      .join('.');
  }

  function lookup(key, lang = locale) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    const normalized = normalizeKey(raw);
    const table = dictionary[normalize(lang)] || dictionary.ar;
    if (Object.prototype.hasOwnProperty.call(table, raw)) return table[raw];
    if (Object.prototype.hasOwnProperty.call(table, normalized)) return table[normalized];
    return '';
  }

  function hasArabic(value) {
    return /[\u0600-\u06FF]/.test(String(value || ''));
  }

  function humanizeEnglish(value) {
    return String(value || '')
      .split('.')
      .map(part => part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase()))
      .join(' · ');
  }

  function safeFallback(key, lang = locale) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    const selected = normalize(lang);
    missingKeys.add(normalizeKey(raw) || raw);
    if (selected === 'ar') {
      return hasArabic(raw) ? raw : dictionary.ar.unknownLabel;
    }
    return hasArabic(raw) ? dictionary.en.unknownLabel : humanizeEnglish(raw);
  }

  function t(key) {
    return lookup(key, locale) || safeFallback(key, locale);
  }

  function label(key) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    const direct = lookup(raw, locale);
    if (direct) return direct;

    const segments = raw.split('.');
    if (segments.length > 1) {
      const translated = segments.map(segment => lookup(segment, locale));
      if (translated.every(Boolean)) return translated.join(' · ');
    }
    return safeFallback(raw, locale);
  }

  function buildReverse(lang) {
    const reverse = new Map();
    Object.entries(dictionary[lang]).forEach(([key, value]) => {
      if (value && !reverse.has(value)) reverse.set(value, key);
    });
    return reverse;
  }

  const reverse = {
    ar: buildReverse('ar'),
    en: buildReverse('en')
  };

  function translateAtom(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const sourceKey = reverse.ar.get(raw) || reverse.en.get(raw);
    if (sourceKey) return lookup(sourceKey, locale) || raw;
    const keyGuess = normalizeKey(raw);
    return lookup(keyGuess, locale) || raw;
  }

  function translateText(text) {
    const raw = String(text ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return raw;

    const direct = translateAtom(trimmed);
    if (direct !== trimmed) return raw.replace(trimmed, direct);

    if (trimmed.includes('·')) {
      const translated = trimmed.split('·').map(part => translateAtom(part.trim())).join(' · ');
      if (translated !== trimmed) return raw.replace(trimmed, translated);
    }
    return raw;
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

    const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
    const target = scope.nodeType === 9 ? scope.documentElement : scope;
    if (!doc?.createTreeWalker || !target) return;
    const walker = doc.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (parent && !['SCRIPT','STYLE','CODE','PRE','TEXTAREA'].includes(parent.tagName)) {
          const next = translateText(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        }
      } else if (node.nodeType === 1) {
        for (const attr of ['title','aria-label','placeholder','data-title']) {
          const value = node.getAttribute?.(attr);
          if (!value) continue;
          const next = translateText(value);
          if (next !== value) node.setAttribute(attr, next);
        }
      }
      node = walker.nextNode();
    }
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
    if (global.parent === global) return;
    if (event.origin !== location.origin) return;
    if (event.source !== global.parent) return;
    if (event.data?.type !== 'admin-locale') return;
    apply(event.data.locale, { persist: true });
  });

  global.BondsAdminI18n = {
    get locale() { return locale; },
    setLocale: apply,
    t,
    label,
    bind,
    translateText,
    normalizeKey,
    formatNumber,
    formatCurrency,
    getMissingKeys() { return Array.from(missingKeys); },
    supported: ['ar', 'en']
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(locale, { persist: false }), { once: true });
  } else {
    apply(locale, { persist: false });
  }
})(window);
