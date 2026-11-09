'use strict';

const crypto = require('crypto');

const DOMAIN = 'https://bonds-global.com';

const COUNTRY_NAMES = {
  SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  AE: { ar: 'الإمارات', en: 'UAE' },
  EG: { ar: 'مصر', en: 'Egypt' },
  JO: { ar: 'الأردن', en: 'Jordan' },
  KW: { ar: 'الكويت', en: 'Kuwait' },
  QA: { ar: 'قطر', en: 'Qatar' },
  BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'عُمان', en: 'Oman' },
  MA: { ar: 'المغرب', en: 'Morocco' },
  TN: { ar: 'تونس', en: 'Tunisia' },
  DZ: { ar: 'الجزائر', en: 'Algeria' },
  IQ: { ar: 'العراق', en: 'Iraq' },
  LB: { ar: 'لبنان', en: 'Lebanon' },
  LY: { ar: 'ليبيا', en: 'Libya' },
  SD: { ar: 'السودان', en: 'Sudan' },
  YE: { ar: 'اليمن', en: 'Yemen' },
  PS: { ar: 'فلسطين', en: 'Palestine' },
  SY: { ar: 'سوريا', en: 'Syria' },
  MR: { ar: 'موريتانيا', en: 'Mauritania' },
  SO: { ar: 'الصومال', en: 'Somalia' },
  DJ: { ar: 'جيبوتي', en: 'Djibouti' },
  KM: { ar: 'جزر القمر', en: 'Comoros' },
  ALL: { ar: 'عربي / إقليمي مشترك', en: 'Pan-Arab / regional' }
};

const TYPE_FOLDER = {
  bank: 'banks',
  fund: 'funds',
  investor: 'investors',
  government_program: 'programs'
};

const TYPE_LABEL = {
  bank: { ar: 'بنك', en: 'Bank' },
  fund: { ar: 'صندوق', en: 'Fund' },
  investor: { ar: 'مستثمر', en: 'Investor' },
  government_program: { ar: 'برنامج حكومي', en: 'Government program' }
};

const SCHEMA_TYPE = {
  bank: 'BankOrCreditUnion',
  fund: 'InvestmentFund',
  investor: 'FinancialService',
  government_program: 'GovernmentService'
};

const PUBLIC_SERVICES = [
  {
    code: 'financial-analysis',
    name_ar: 'التحليل المالي',
    name_en: 'Financial Analysis',
    desc_ar: 'قراءة القوائم والمؤشرات والسيولة والربحية ومقارنة الأداء الفعلي بالمخطط.',
    desc_en: 'Reading financial statements, liquidity and profitability indicators, and comparing actual versus planned performance.',
    href_ar: '/my-bonds/workspace/?service=financial_analysis',
    href_en: '/en/my-bonds/workspace/?service=financial_analysis',
    category_ar: 'الاستشارات المالية',
    category_en: 'Financial consulting'
  },
  {
    code: 'cash-flow',
    name_ar: 'إدارة التدفقات النقدية',
    name_en: 'Cash Flow Management',
    desc_ar: 'توقع النقد الداخل والخارج وتحديد فجوات السيولة وأولويات التحصيل والدفع.',
    desc_en: 'Cash inflow and outflow mapping, payment prioritization, and early warning of liquidity shortages.',
    href_ar: '/calculators/cash-flow.html',
    href_en: '/en/calculators/cash-flow.html',
    category_ar: 'الاستشارات المالية',
    category_en: 'Financial consulting'
  },
  {
    code: 'budgeting',
    name_ar: 'الموازنات والتقديرات',
    name_en: 'Budgeting & Forecasting',
    desc_ar: 'بناء موازنات تشغيلية ومالية وربطها بالسيناريوهات ومؤشرات الأداء.',
    desc_en: 'Realistic monthly and quarterly budgets with actual versus planned comparison.',
    href_ar: '/budgeting.html',
    href_en: '/en/budgeting.html',
    category_ar: 'الاستشارات المالية',
    category_en: 'Financial consulting'
  },
  {
    code: 'financial-strategy',
    name_ar: 'الاستراتيجية المالية',
    name_en: 'Financial Strategy',
    desc_ar: 'ترتيب الأولويات الاستثمارية وربطها بالقدرة التمويلية والسيولة وخطة التنفيذ.',
    desc_en: 'Clear KPIs, investment priorities and a short-term implementation plan.',
    href_ar: '/contact.html',
    href_en: '/en/contact.html',
    category_ar: 'الاستشارات المالية',
    category_en: 'Financial consulting'
  },
  {
    code: 'feasibility-study',
    name_ar: 'دراسات الجدوى',
    name_en: 'Feasibility Studies',
    desc_ar: 'السوق، الدراسة الفنية، التكاليف، الإيرادات، التدفقات، الحساسية والمخاطر.',
    desc_en: 'Market, technical, cost, revenue, cash-flow, sensitivity and risk analysis before investment.',
    href_ar: '/feasibility-study.html',
    href_en: '/en/feasibility-study.html',
    category_ar: 'الدراسات والتقييم',
    category_en: 'Studies and valuation'
  },
  {
    code: 'valuation',
    name_ar: 'التقييم المالي',
    name_en: 'Financial Valuation',
    desc_ar: 'تقييم الشركات والأصول والمشروعات بالمنهجيات المناسبة وطبيعة البيانات المتاحة.',
    desc_en: 'Valuation of companies, assets and projects using methods suited to available data.',
    href_ar: '/valuation/',
    href_en: '/en/valuation/',
    category_ar: 'الدراسات والتقييم',
    category_en: 'Studies and valuation'
  },
  {
    code: 'risk-analysis',
    name_ar: 'تحليل المخاطر',
    name_en: 'Risk Analysis',
    desc_ar: 'تحديد مصادر الخطر وقياس أثرها واختبار سيناريوهات الاستجابة والحدود المقبولة.',
    desc_en: 'Identifying financial, operational and market risks and testing response scenarios.',
    href_ar: '/contact.html',
    href_en: '/en/contact.html',
    category_ar: 'الدراسات والتقييم',
    category_en: 'Studies and valuation'
  },
  {
    code: 'funding-extraction',
    name_ar: 'استخراج التمويل',
    name_en: 'Funding Extraction',
    desc_ar: 'إعداد المسار والملف ومساندة العميل للوصول إلى خيارات التمويل المناسبة.',
    desc_en: 'Preparing the file and path so the client can reach suitable financing options.',
    href_ar: '/funding-extraction.html',
    href_en: '/en/funding-extraction.html',
    category_ar: 'التمويل والتحول',
    category_en: 'Funding and transformation'
  },
  {
    code: 'funding-readiness',
    name_ar: 'جاهزية التمويل',
    name_en: 'Funding Readiness',
    desc_ar: 'فحص البيانات والهيكل والقدرة على السداد قبل التقديم.',
    desc_en: 'Checking data, structure and repayment capacity before applying.',
    href_ar: '/funding-readiness.html',
    href_en: '/en/funding-readiness.html',
    category_ar: 'التمويل والتحول',
    category_en: 'Funding and transformation'
  },
  {
    code: 'operational-consulting',
    name_ar: 'الاستشارات التشغيلية',
    name_en: 'Operational Consulting',
    desc_ar: 'تحسين العمليات وتوزيع المسؤوليات وربط الأداء بالنتيجة المالية.',
    desc_en: 'Simplifying procedures, distributing roles and linking performance to financial results.',
    href_ar: '/contact.html',
    href_en: '/en/contact.html',
    category_ar: 'التمويل والتحول',
    category_en: 'Funding and transformation'
  },
  {
    code: 'market-research',
    name_ar: 'البحوث السوقية',
    name_en: 'Surveys & Market Research',
    desc_ar: 'جمع وتحليل بيانات السوق والعملاء لدعم القرار الاستثماري والتجاري.',
    desc_en: 'Designing surveys and market studies to support investment and expansion decisions.',
    href_ar: '/contact.html',
    href_en: '/en/contact.html',
    category_ar: 'التمويل والتحول',
    category_en: 'Funding and transformation'
  },
  {
    code: 'scientific-research',
    name_ar: 'البحث العلمي',
    name_en: 'Scientific Research',
    desc_ar: 'تصميم بحث علمي بمنهجية وفرضية ومصادر أدلة لدعم القرار.',
    desc_en: 'Designing scientific research with methodology, hypothesis and evidence sources to support the decision.',
    href_ar: '/my-bonds/workspace/?service=scientific_research',
    href_en: '/en/my-bonds/workspace/?service=scientific_research',
    category_ar: 'الدراسات والسوق',
    category_en: 'Studies and market'
  },
  {
    code: 'daily-journal-entries',
    name_ar: 'القيود اليومية',
    name_en: 'Daily Journal Entries',
    desc_ar: 'تسجيل القيود ومراجعة التوازن على الكيان المحاسبي المعتمد.',
    desc_en: 'Recording journal entries and reviewing balance on the approved accounting entity.',
    href_ar: '/my-bonds/workspace/?service=daily_journal_entries',
    href_en: '/en/my-bonds/workspace/?service=daily_journal_entries',
    category_ar: 'المحاسبة والتقارير',
    category_en: 'Accounting and reporting'
  },
  {
    code: 'financial-statements',
    name_ar: 'القوائم المالية',
    name_en: 'Financial Statements',
    desc_ar: 'إعداد قائمة الدخل والمركز المالي والتدفقات من دفتر الأستاذ.',
    desc_en: 'Preparing income statement, balance sheet and cash-flow from the ledger.',
    href_ar: '/my-bonds/workspace/?service=financial_statements',
    href_en: '/en/my-bonds/workspace/?service=financial_statements',
    category_ar: 'المحاسبة والتقارير',
    category_en: 'Accounting and reporting'
  },
  {
    code: 'planning-budgeting-forecasting',
    name_ar: 'الموازنة والتوقع',
    name_en: 'Planning, Budgeting & Forecasting',
    desc_ar: 'خطة محكومة مرتبطة بالفترات والحسابات الفعلية.',
    desc_en: 'A governed plan linked to periods and actual accounts.',
    href_ar: '/my-bonds/workspace/?service=planning_budgeting_forecasting',
    href_en: '/en/my-bonds/workspace/?service=planning_budgeting_forecasting',
    category_ar: 'المحاسبة والتقارير',
    category_en: 'Accounting and reporting'
  },
  {
    code: 'zakat-return-preparation',
    name_ar: 'الإقرار الزكوي',
    name_en: 'Zakat Return Preparation',
    desc_ar: 'إعداد ومراجعة الإقرار وربطه بالبيانات المالية قبل التقديم.',
    desc_en: 'Preparing and reviewing the zakat return and linking it to the financial data before filing.',
    href_ar: '/service-request.html?service=zakat_return_preparation',
    href_en: '/en/service-request.html?service=zakat_return_preparation',
    category_ar: 'الزكاة والضريبة',
    category_en: 'Zakat and tax'
  },
  {
    code: 'vat-return-preparation',
    name_ar: 'إقرار ضريبة القيمة المضافة',
    name_en: 'VAT Return Preparation',
    desc_ar: 'مراجعة المدخلات والمخرجات والتسويات قبل الإقرار.',
    desc_en: 'Reviewing inputs, outputs and adjustments before the VAT return.',
    href_ar: '/service-request.html?service=vat_return_preparation',
    href_en: '/en/service-request.html?service=vat_return_preparation',
    category_ar: 'الزكاة والضريبة',
    category_en: 'Zakat and tax'
  },
  {
    code: 'tax-health-check',
    name_ar: 'المراجع الزكوي والضريبي',
    name_en: 'Zakat & Tax Health Check',
    desc_ar: 'مراجعة شاملة للمخاطر والنواقص قبل التقديم أو الفحص.',
    desc_en: 'A full review of risks and gaps before filing or inspection.',
    href_ar: '/service-request.html?service=tax_health_check',
    href_en: '/en/service-request.html?service=tax_health_check',
    category_ar: 'الزكاة والضريبة',
    category_en: 'Zakat and tax'
  }
];

function sourceSlug(id) {
  return String(id || '').replace(/^fs-/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

function sourceFolder(type) {
  return TYPE_FOLDER[type] || 'sources';
}

function sourcePath(source, lang) {
  const folder = sourceFolder(source.type);
  const slug = sourceSlug(source.id);
  const rel = `directory/${folder}/${slug}`;
  return lang === 'en' ? `/en/${rel}` : `/${rel}`;
}

function sectorPath(code, lang) {
  const rel = `directory/sectors/${String(code || '').toLowerCase()}`;
  return lang === 'en' ? `/en/${rel}` : `/${rel}`;
}

function servicePath(code, lang) {
  const rel = `directory/services/${String(code || '').toLowerCase()}`;
  return lang === 'en' ? `/en/${rel}` : `/${rel}`;
}

function countryLabel(code, lang) {
  const key = String(code || '').toUpperCase();
  const row = COUNTRY_NAMES[key] || COUNTRY_NAMES.ALL;
  return lang === 'en' ? row.en : row.ar;
}

function fingerprint(kind, id, extra) {
  const digest = crypto
    .createHash('sha256')
    .update(`bonds-directory|${kind}|${id}|${extra || ''}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  const prefix = String(kind || 'DIR').slice(0, 3).toUpperCase();
  return `BFP-${prefix}-${digest}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function ogImage(title, description, lang) {
  const params = new URLSearchParams({
    title: String(title || '').slice(0, 80),
    description: String(description || '').slice(0, 140),
    lang: lang === 'en' ? 'en' : 'ar'
  });
  return `${DOMAIN}/api/og-image?${params.toString()}`.replace(/&/g, '&amp;');
}

module.exports = {
  DOMAIN,
  COUNTRY_NAMES,
  TYPE_FOLDER,
  TYPE_LABEL,
  SCHEMA_TYPE,
  PUBLIC_SERVICES,
  sourceSlug,
  sourceFolder,
  sourcePath,
  sectorPath,
  servicePath,
  countryLabel,
  fingerprint,
  escapeHtml,
  jsonLd,
  ogImage
};
