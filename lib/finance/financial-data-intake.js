'use strict';

const crypto = require('crypto');
const { runFinancialEngine } = require('./financial-engine-registry');
const { auditEquityRollForward } = require('./three-statement-consistency');

const ACTION_ENGINE = Object.freeze({
  financial_analysis_run: 'financial_analysis',
  cash_flow_analysis_run: 'cash_flow_analysis',
  funding_readiness_run: 'funding_readiness',
  creditworthiness_run: 'creditworthiness',
  feasibility_run: 'feasibility',
  valuation_run: 'valuation',
  risk_analysis_run: 'risk_analysis',
  scenario_forecast_run: 'scenario_forecast'
});

const FIELD_DICTIONARY = Object.freeze({
  opening_equity: ['opening equity','equity at beginning of year','حقوق الملكية أول المدة','رصيد حقوق الملكية الافتتاحي'],
  owner_contributions: ['owner contributions','capital contributions','مساهمات الملاك','زيادات رأس المال'],
  owner_distributions: ['owner distributions','dividends paid','توزيعات الملاك','توزيعات الأرباح'],
  other_equity_movements: ['other equity movements','other comprehensive income movements','حركات حقوق الملكية الأخرى','التغيرات الأخرى في حقوق الملكية'],
  total_debt: ['total debt','إجمالي الدين','اجمالي الدين','إجمالي المديونية','اجمالي المديونية'],
  equity: ['equity','total equity',"shareholders equity","shareholders' equity",'حقوق الملكية','إجمالي حقوق الملكية','اجمالي حقوق الملكية','مجموع حقوق الملكية'],
  total_assets: ['total assets','إجمالي الأصول','اجمالي الأصول','مجموع الموجودات','إجمالي الموجودات'],
  total_liabilities: ['total liabilities','إجمالي الالتزامات','اجمالي الالتزامات','مجموع الالتزامات'],
  current_assets: ['current assets','الأصول المتداولة','الاصول المتداولة','مجموع الموجودات المتداولة','مجموع الأصول المتداولة'],
  current_liabilities: ['current liabilities','الالتزامات المتداولة','مجموع الالتزامات المتداولة'],
  cash: ['cash','cash and cash equivalents','النقد','النقد وما في حكمه'],
  revenue: ['revenue','sales revenue','الإيرادات','الايرادات'],
  cogs: ['cost of goods sold','cost of sales','cogs','تكلفة المبيعات','تكلفة الإيرادات'],
  operating_expenses: ['operating expenses','opex','المصروفات التشغيلية','المصروفات العمومية والإدارية','مجموع المصروفات العمومية والإدارية','إجمالي المصروفات العمومية والإدارية'],
  total_expenses: ['total expenses','total expense','إجمالي المصروفات','اجمالي المصروفات','مجموع المصروفات'],
  operating_income: ['operating income','operating profit','الربح التشغيلي'],
  net_income: ['net income','net profit','صافي الربح','صافي الربح بعد الزكاة','صافي ربح الفترة','صافي ربح السنة الفترة بعد الزكاة'],
  // Exact subtotals are distinct from their components; do not combine them by guessing.
  ebitda: ['ebitda'],
  depreciation_amortization: ['depreciation and amortization','depreciation amortization','d&a','الإهلاك والإطفاء','الاهلاك والاطفاء','الإهلاك والاطفاء','استهلاك وإهلاك الممتلكات والمعدات'],
  operating_cash_flow: ['operating cash flow','net cash from operating activities','التدفقات النقدية التشغيلية','صافي التدفقات النقدية التشغيلية','صافي النقد الناتج من الأنشطة التشغيلية'],
  investing_cash_flow: ['investing cash flow','net cash from investing activities','التدفقات النقدية الاستثمارية','صافي النقد الناتج من المستخدم في الأنشطة الاستثمارية','صافي النقد الناتج من الأنشطة الاستثمارية'],
  financing_cash_flow: ['financing cash flow','net cash from financing activities','التدفقات النقدية التمويلية','صافي النقد الناتج من المستخدم في الأنشطة التمويلية','صافي النقد الناتج من الأنشطة التمويلية'],
  scheduled_debt_service: ['scheduled debt service','principal and interest due','أقساط وخدمة الدين المستحقة','خدمة الدين المستحقة'],
  cash_available_for_debt_service: ['cash available for debt service','cfads','النقد المتاح لخدمة الدين','التدفق النقدي المتاح لخدمة الدين'],
  payables: ['accounts payable','trade payables','الذمم الدائنة','الدائنون التجاريون','الموردون والذمم الدائنة التجارية'],
  one_off_income: ['non recurring income','non-recurring income','one off income','الدخل غير المتكرر','الأرباح غير المتكررة'],
  interest_expense: ['interest expense','finance cost','مصروف الفوائد','تكلفة التمويل'],
  inventory: ['inventory','المخزون'],
  receivables: ['receivables','accounts receivable','الذمم المدينة','المدينون','الذمم المدينة التجارية'],
  prior_revenue: ['prior revenue','previous revenue','إيرادات الفترة السابقة','ايرادات الفترة السابقة'],
  prior_net_income: ['prior net income','previous net income','صافي ربح الفترة السابقة'],
  cost_of_equity_pct: ['cost of equity','cost of equity %','تكلفة حقوق الملكية','تكلفة حقوق الملكية %'],
  cost_of_debt_pct: ['cost of debt','cost of debt %','تكلفة الدين','تكلفة الدين %'],
  tax_rate_pct: ['tax rate','tax rate %','معدل الضريبة','معدل الضريبة %'],
  opening_balance: ['opening balance','opening cash balance','الرصيد الافتتاحي','رصيد افتتاحي','النقد وما في حكمه أول الفترة'],
  ending_cash: ['ending cash','ending cash balance','cash at end of period','النقد في نهاية الفترة','الرصيد النقدي الختامي','النقد وما في حكمه آخر الفترة'],
  cash_flow_net_income: ['net income per cash flow','cash flow net income','صافي الربح بقائمة التدفقات','صافي الدخل بقائمة التدفقات','صافي ربح السنة الفترة بعد الزكاة','صافي ربح السنة / الفترة بعد الزكاة'],
  zakat_base: ['zakat base','وعاء الزكاة','الوعاء الزكوي'],
  zakat_due: ['zakat due','zakat payable','الزكاة المستحقة','مبلغ الزكاة المستحق'],
  taxable_sales: ['taxable sales','standard rated sales','المبيعات الخاضعة','المبيعات الخاضعة للضريبة'],
  zero_rated_sales: ['zero rated sales','المبيعات صفرية الضريبة','المبيعات الخاضعة بنسبة صفر'],
  exempt_sales: ['exempt sales','المبيعات المعفاة'],
  output_vat: ['output vat','output tax','ضريبة المخرجات','ضريبة القيمة المضافة على المبيعات'],
  taxable_purchases: ['taxable purchases','standard rated purchases','المشتريات الخاضعة','المشتريات الخاضعة للضريبة'],
  input_vat: ['input vat','input tax','ضريبة المدخلات','ضريبة القيمة المضافة على المشتريات'],
  vat_net_due: ['net vat due','vat payable','vat refundable','صافي ضريبة القيمة المضافة','صافي الضريبة المستحقة'],
  withholding_tax_base: ['withholding tax base','wht base','وعاء ضريبة الاستقطاع'],
  withholding_tax_due: ['withholding tax due','wht due','ضريبة الاستقطاع المستحقة'],
  taxable_income: ['taxable income','الدخل الخاضع للضريبة'],
  income_tax_due: ['income tax due','income tax payable','ضريبة الدخل المستحقة'],
  real_estate_transaction_value: ['real estate transaction value','property transaction value','قيمة التصرف العقاري'],
  rett_due: ['rett due','real estate transaction tax due','ضريبة التصرفات العقارية المستحقة'],
  excise_tax_base: ['excise tax base','وعاء الضريبة الانتقائية'],
  excise_tax_due: ['excise tax due','الضريبة الانتقائية المستحقة']
});

const ALL_FIELDS = Object.freeze(Object.keys(FIELD_DICTIONARY));
// The comprehensive analysis must read all its own recognized financial fields,
// not tax/filing fields belonging to unrelated services.
const FINANCIAL_ANALYSIS_FIELDS = Object.freeze([
 'revenue','cogs','operating_expenses','total_expenses','ebitda','net_income',
 'current_assets','current_liabilities','cash','inventory','operating_income',
 'prior_revenue','prior_net_income','cost_of_equity_pct','cost_of_debt_pct',
 'tax_rate_pct','total_assets','total_liabilities','equity','total_debt',
 'interest_expense','receivables','depreciation_amortization','operating_cash_flow',
 'investing_cash_flow','financing_cash_flow','opening_balance','ending_cash',
 'scheduled_debt_service','cash_available_for_debt_service','payables',
 'one_off_income','cash_flow_net_income','opening_equity','owner_contributions',
 'owner_distributions','other_equity_movements'
]);

const SERVICE_INTAKE_PROFILES = Object.freeze({
  zakat_return_preparation: {
    required: ['net_income','total_assets','total_liabilities','equity'],
    fields: ['net_income','total_assets','total_liabilities','equity','zakat_base','zakat_due']
  },
  zakat_base_review: {
    required: ['total_assets','total_liabilities','equity'],
    fields: ['total_assets','total_liabilities','equity','net_income','zakat_base','zakat_due']
  },
  zakat_assessment_objection: {
    required: ['zakat_base','zakat_due'],
    fields: ['zakat_base','zakat_due','net_income','total_assets','total_liabilities','equity']
  },
  zakat_certificate_support: {
    required: ['zakat_due'],
    fields: ['zakat_base','zakat_due']
  },
  vat_registration: {
    required: ['revenue'],
    fields: ['revenue','taxable_sales','zero_rated_sales','exempt_sales']
  },
  vat_return_preparation: {
    required: ['output_vat','input_vat'],
    fields: ['taxable_sales','zero_rated_sales','exempt_sales','output_vat','taxable_purchases','input_vat','vat_net_due']
  },
  vat_refund_review: {
    required: ['input_vat','output_vat'],
    fields: ['taxable_sales','output_vat','taxable_purchases','input_vat','vat_net_due']
  },
  vat_compliance_review: {
    required: ['output_vat','input_vat'],
    fields: ['revenue','taxable_sales','zero_rated_sales','exempt_sales','output_vat','taxable_purchases','input_vat','vat_net_due']
  },
  withholding_tax_return: {
    required: ['withholding_tax_base'],
    fields: ['withholding_tax_base','withholding_tax_due']
  },
  foreign_entity_income_tax: {
    required: ['taxable_income'],
    fields: ['revenue','net_income','taxable_income','income_tax_due']
  },
  real_estate_transaction_tax: {
    required: ['real_estate_transaction_value'],
    fields: ['real_estate_transaction_value','rett_due']
  },
  excise_tax_compliance: {
    required: ['excise_tax_base'],
    fields: ['excise_tax_base','excise_tax_due']
  },
  e_invoicing_compliance: {
    required: ['revenue'],
    fields: ['revenue','taxable_sales','output_vat','taxable_purchases','input_vat']
  },
  tax_audit_readiness: {
    required: ['revenue','total_assets','total_liabilities','equity'],
    fields: ['revenue','net_income','total_assets','total_liabilities','equity','zakat_base','zakat_due','output_vat','input_vat','vat_net_due','withholding_tax_due','income_tax_due']
  },
  tax_objection_dispute_support: {
    required: ['revenue'],
    fields: ['revenue','net_income','zakat_base','zakat_due','output_vat','input_vat','vat_net_due','withholding_tax_due','income_tax_due','rett_due','excise_tax_due']
  },
  tax_penalty_review: {
    required: ['revenue'],
    fields: ['revenue','zakat_due','vat_net_due','withholding_tax_due','income_tax_due','rett_due','excise_tax_due']
  },
  tax_health_check: {
    required: ['revenue','total_assets','total_liabilities','equity'],
    fields: ['revenue','net_income','total_assets','total_liabilities','equity','cash','receivables','inventory','zakat_base','zakat_due','taxable_sales','zero_rated_sales','exempt_sales','output_vat','taxable_purchases','input_vat','vat_net_due','withholding_tax_base','withholding_tax_due','taxable_income','income_tax_due','real_estate_transaction_value','rett_due','excise_tax_base','excise_tax_due']
  }
});
const REQUIRED_ALTERNATIVES = Object.freeze({
  equity_or_total_assets_and_total_liabilities: ['equity','total_assets','total_liabilities'],
  ebitda_or_revenue_cogs_operating_expenses: ['ebitda','revenue','cogs','operating_expenses'],
  cost_of_debt_pct_or_interest_expense: ['cost_of_debt_pct','interest_expense']
});

const DOCUMENT_TYPE_HINTS = Object.freeze([
  ['audit_report', /audit(?:or)? report|independent auditor|تقرير المراجع|تقرير المدقق/i],
  ['balance_sheet', /balance sheet|statement of financial position|قائمة المركز المالي|الميزانية العمومية/i],
  ['income_statement', /income statement|profit and loss|p&l|قائمة الدخل|الأرباح والخسائر|الارباح والخسائر/i],
  ['cash_flow', /cash flow statement|statement of cash flows|قائمة التدفقات النقدية|التدفقات النقدية/i],
  ['trial_balance', /trial balance|ميزان المراجعة/i],
  ['bank_statement', /bank statement|كشف حساب بنكي|كشف الحساب البنكي/i],
  ['feasibility_study', /feasibility study|دراسة جدوى/i],
  ['financial_report', /financial report|financial statements|تقرير مالي|القوائم المالية/i],
  ['zakat_return', /zakat return|zakat declaration|إقرار زكوي|الإقرار الزكوي/i],
  ['vat_return', /vat return|value added tax return|إقرار ضريبة القيمة المضافة|اقرار ضريبة القيمة المضافة/i],
  ['tax_invoice', /tax invoice|vat invoice|فاتورة ضريبية|الفاتورة الضريبية/i],
  ['e_invoice', /e-invoice|electronic invoice|فاتورة إلكترونية|فاتورة الكترونية/i]
]);

function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[：:؛;,.،()\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORMALIZED_ALIASES = Object.freeze(Object.fromEntries(
  Object.entries(FIELD_DICTIONARY).map(([key, aliases]) => [
    key,
    new Set([key, ...aliases].map(normalizeLabel))
  ])
));

function canonicalField(label) {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;
  // PDF.js may split joined Arabic words across positioned text spans.
  // Only accept these narrowly scoped, multi-word accounting captions.
  const arabicCompact=normalized.replace(/[أإآٱ]/g,'ا').replace(/\s+/g,'');
  if (/المصروفات/.test(arabicCompact) && /العمومية/.test(arabicCompact) &&
      /ادارية/.test(arabicCompact)) return 'operating_expenses';
  if (/الممتلكات/.test(arabicCompact) && /والمعدات/.test(arabicCompact) &&
      /استه/.test(arabicCompact) && /اه/.test(arabicCompact)) return 'depreciation_amortization';
  for (const [key, aliases] of Object.entries(NORMALIZED_ALIASES)) {
    if (aliases.has(normalized)) return key;
    // Some PDF extractors reverse Arabic word order in RTL text.
    // Compare complete Arabic token sets, never substrings or guessed labels.
    if (/[\u0600-\u06ff]/.test(normalized)) {
      const words = s => s.split(/\s+/).filter(Boolean).sort().join(' ');
      if ([...aliases].some(alias => /[\u0600-\u06ff]/.test(alias) && words(alias) === words(normalized))) return key;
    }
  }
  return null;
}

function arabicDigitsToAscii(value) {
  const eastern='٠١٢٣٤٥٦٧٨٩', persian='۰۱۲۳۴۵۶۷۸۹';
  return String(value ?? '')
    .replace(/[٠-٩]/g, d => String(eastern.indexOf(d)))
    .replace(/[۰-۹]/g, d => String(persian.indexOf(d)));
}

function parseNumeric(value) {
  let raw = arabicDigitsToAscii(value).trim();
  if (!raw) return null;
  const negative = /[()]/.test(raw);
  raw = raw.replace(/[()]/g, '')
    .replace(/[\u066C,\s]/g, '')
    .replace(/\u066B/g, '.')
    .replace(/[^0-9.+-]/g, '');
  if (!raw || !/[0-9]/.test(raw)) return null;
  const number = Number(raw);
  if (!Number.isFinite(number)) return null;
  return negative ? -Math.abs(number) : number;
}

function detectCurrency(value) {
  const text=String(value ?? '');
  if (/\bSAR\b|ر\.?\s?س|ريال\s+سعودي|سعودي\s+ريال/i.test(text)) return 'SAR';
  if (/\bUSD\b|دولار\s+(?:أمريكي|امريكي)|\$/i.test(text)) return 'USD';
  if (/\bEUR\b|يورو|€/i.test(text)) return 'EUR';
  if (/\bEGP\b|جنيه\s+مصري/i.test(text)) return 'EGP';
  if (/\bAED\b|درهم\s+إماراتي/i.test(text)) return 'AED';
  return null;
}

function detectUnit(value) {
  const text=String(value ?? '').toLowerCase();
  // Arabic letter sequences such as "الفترة" must never be read as "الف" (thousand).
  const token=/(?:^|[\s(\[،:])(?:ألف|الف|آلاف|الآف|بالألف|بالالف|بالآلاف|الألف|الالف|مليون|ملايين|بالمليون|بالملايين)(?=$|[\s)\]،:.;])/u;
  const matches=text.match(token);
  const unitWord=matches ? matches[0].trim() : '';
  if (/\bmillions?\b/.test(text) || /مليون|ملايين/.test(unitWord))
    return { unit:'million', multiplier:1_000_000 };
  if (/\bthousands?\b/.test(text) || /ألف|الف|آلاف|الآف/.test(unitWord))
    return { unit:'thousand', multiplier:1_000 };
  return { unit:'base', multiplier:1 };
}

function detectPeriod(value) {
  const text=arabicDigitsToAscii(value);
  const quarter=text.match(/\bQ([1-4])\s*[-/]?\s*(20\d{2})\b/i);
  if (quarter) return 'Q'+quarter[1]+' '+quarter[2];
  const year=text.match(/\b(20\d{2})\b/);
  return year ? year[1] : null;
}

function candidate(field, rawValue, context, provenance) {
  const numeric=parseNumeric(rawValue);
  if (numeric === null) return null;
  const unit=detectUnit(context);
  return {
    field,
    value:(numeric < 0 && ['cogs','operating_expenses','total_expenses','depreciation_amortization','interest_expense'].includes(field) ? Math.abs(numeric) : numeric) * unit.multiplier,
    raw_value:String(rawValue),
    currency:detectCurrency(context),
    unit:unit.unit,
    period:detectPeriod(context),
    confidence: provenance?.extraction_method === 'tabular_parser' ? 0.95 : 0.85,
    provenance
  };
}

function tabularYearColumns(rows){
 const candidateRows=(Array.isArray(rows)?rows:[]).slice(0,12);
 for(let rowIndex=0;rowIndex<candidateRows.length;rowIndex++){
  const cells=Array.isArray(candidateRows[rowIndex])?candidateRows[rowIndex]:[];
  // Arabic PDF table detectors can put "البيان" in the LAST column.
  const labelColumns=cells.map((v,i)=>/^(description|account|particulars|item|year|البيان|البند|الوصف|الحساب|السنوات)$/.test(normalizeLabel(v))?i:null).filter(x=>x!==null);
  if(!labelColumns.length)continue;
  const years=cells.map((cell,col)=>{
   const text=arabicDigitsToAscii(cell).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
   const candidates=[...text.matchAll(/\b(20\d{2})\b/g)];
   return candidates.length===1?{column:col,period:candidates[0][1]}:null;
  }).filter(Boolean);
  if(years.length>=2&&new Set(years.map(y=>y.period)).size===years.length){
   return {rowIndex,years:years.sort((a,b)=>Number(b.period)-Number(a.period))};
  }
 }
 return null;
}
function extractFromRows(rows, sheetName, wanted, financialAnalysisMode=false, page=null) {
 const found=[];
 const sourceRows=Array.isArray(rows)?rows:[];
 const headingText=sourceRows.slice(0,12).map(row=>(Array.isArray(row)?row:[row]).join(' ')).join(' ');
 const headingCurrency=detectCurrency(headingText);
 const headingUnit=detectUnit(headingText);
 const applyHeading=hit=>{
  if(!hit)return hit;
  hit.currency=hit.currency||headingCurrency;
  if(hit.unit==='base' && headingUnit.multiplier>1){
   hit.value*=headingUnit.multiplier;
   hit.unit=headingUnit.unit;
  }
  return hit;
 };
 const columns=financialAnalysisMode?tabularYearColumns(sourceRows):null;
 sourceRows.forEach((row,rowIndex)=>{
  const cells=Array.isArray(row)?row:[];
  for(let col=0;col<cells.length;col++){
   const field=canonicalField(cells[col]);
   if(!field||!wanted.has(field))continue;
   if(columns&&rowIndex>columns.rowIndex&&!columns.years.some(y=>y.column===col)){
    // A blank current-year value is never replaced with a prior-year value.
    if(parseNumeric(cells[columns.years[0].column])===null)continue;
    for(const year of columns.years){
     const hit=candidate(field,cells[year.column],String(cells[col])+' '+year.period,{
      extraction_method:'tabular_parser',sheet:sheetName||null,...(page?{page}:{}),
      row:rowIndex+1,column:year.column+1,period:year.period,label:String(cells[col])
     });
     if(hit){hit.period=year.period;found.push(applyHeading(hit));}
    }
    continue;
   }
   const following=financialAnalysisMode&&!columns
    ?cells.filter((value,index)=>index!==col&&parseNumeric(value)!==null).map(value=>({value,column:cells.indexOf(value)+1}))
    :[{value:cells[col+1],column:col+2}];
   for(const next of following){
    const context=cells.join(' ');
    const hit=candidate(field,next.value,context,{
     extraction_method:'tabular_parser',sheet:sheetName||null,...(page?{page}:{}),
     row:rowIndex+1,column:next.column,label:String(cells[col])
    });
    if(hit)found.push(applyHeading(hit));
   }
  }
 });
 return found;
}

// PDF extraction returns linearized text rather than reliable table coordinates.
// Recognize comparative amounts ONLY when an explicit dated header determines
// the left-to-right period order. Otherwise preserve ambiguity for review.
function extractFromText(text, wanted, financialAnalysisMode=false) {
 const found=[];
 const clean=value=>arabicDigitsToAscii(String(value||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g,'')).trim();
 const lines=String(text||'').split(/\r?\n/);
 const numbers=/\(?[+-]?(?:\d{1,3}(?:[,\u066c]\d{3})+|\d+)(?:[.\u066b]\d+)?\)?/g;
 const amountPattern=/^\(?[-+]?(?:\d{1,3}(?:[,]\d{3})+|\d+)(?:\.\d+)?\)?$/;
 const isCell=value=>amountPattern.test(clean(value).replace(/[()\s]/g,''))||/^[—–-]$/.test(clean(value));
 const validYear=value=>{
  const s=clean(value),y=[...s.matchAll(/\b(20\d{2})\b/g)];
  return y.length===1 && /(?:سبتمبر|ديسمبر|september|december|31|30)/i.test(s)?y[0][1]:null;
 };
 let datedColumns=null;
 let headingCurrency=null;
 let headingUnit={unit:'base',multiplier:1};
 let statementSection=null;
 const applyTextHeading=hit=>{
  if(!hit)return hit;
  hit.currency=hit.currency||headingCurrency;
  if(hit.unit==='base'&&headingUnit.multiplier>1){
   hit.value*=headingUnit.multiplier;
   hit.unit=headingUnit.unit;
  }
  return hit;
 };
 for(let index=0;index<lines.length;index++){
  const line=clean(lines[index]);
  if(!line)continue;
  const heading=normalizeLabel(line);
  const headerWords=heading.split(/\s+/).filter(Boolean);
  const hasWords=(...words)=>words.every(word=>headerWords.includes(word));
  // Text extraction in RTL PDFs often reverses the visual order of heading words.
  if(/قائمة التدفقات النقدية|statement of cash flows|cash flow statement/i.test(line)||
     hasWords('قائمة','التدفقات','النقدية'))statementSection='cash_flow';
  else if(/قائمة الدخل|income statement|profit and loss statement/i.test(line)||
     hasWords('قائمة','الدخل'))statementSection='income';
  else if(/قائمة المركز المالي|balance sheet|statement of financial position/i.test(line)||
     hasWords('قائمة','المركز','المالي'))statementSection='balance';
  // PDF layouts commonly show currency in the column heading, not each row.
  if(lines[index].includes('\f')){
   headingCurrency=null;
   headingUnit={unit:'base',multiplier:1};
  }
  const namedUnit=detectUnit(line);
  if(namedUnit.multiplier>1 && /وحدة|المبالغ|الأرقام|بالألف|بالمليون|ألف ريال|مليون ريال|thousand|million/i.test(line))
   headingUnit=namedUnit;
  const namedCurrency=detectCurrency(line);
  if(namedCurrency && /ريال|درهم|دولار|جنيه|يورو|\bSAR\b|\bUSD\b|\bEUR\b|\bEGP\b|\bAED\b/i.test(line))
    headingCurrency=namedCurrency;
  // Expire dated columns on page boundaries; a year in a note is not a header.
  if(lines[index].includes('\f') || /^--\s*\d+\s+of\s+\d+\s*--$/.test(line))datedColumns=null;
  if(financialAnalysisMode) {
   const headerTail=line.match(/^(?:البيان|البند|الوصف|الحساب|description|particulars|item|account)\s*[:-]?\s+(.+)$/i)?.[1]||'';
   const bare=headerTail.match(/^(20\d{2})(?:\s*م)?\s+(20\d{2})(?:\s*م)?$/i);
   const full=headerTail.match(/^31\s+(?:ديسمبر|december)\s+(20\d{2})\s+31\s+(?:ديسمبر|december)\s+(20\d{2})$/i);
   const numeric=headerTail.match(/^31[/-]12[/-](20\d{2})\s+31[/-]12[/-](20\d{2})$/);
   let periods=bare||full||numeric;
   let extended=false;
   // pdfjs/Poppler can emit "البيان" then one date per line.
   if(!periods && /^(?:البيان|البند|description|particulars|item|account)$/i.test(line)){
    const first=validYear(lines[index+1]),second=validYear(lines[index+2]);
    if(first&&second) {periods=[null,first,second];extended=true;}
   }
   // Column labels can also follow their two dates in visually RTL tables.
   if(!periods && /(?:البيان|description|particulars)/i.test(line)){
    const ys=[...line.matchAll(/\b(20\d{2})\b/g)].map(m=>m[1]);
    if(ys.length===2 && /(?:سبتمبر|ديسمبر|september|december)/i.test(line)) {
     periods=[null,ys[0],ys[1]];extended=true;
    }
   }
   if(periods&&periods[1]!==periods[2]){
    datedColumns={periods:[periods[1],periods[2]],at:index,maxGap:extended?120:40};
    continue;
   }
   if(datedColumns&&index-datedColumns.at>datedColumns.maxGap)datedColumns=null;
  }
  // Entire PDF rows may be emitted as "label / 2026 amount / 2025 amount",
  // or as "2025 amount / 2026 amount / label".
  let name=line;
  let rawAmounts=(line.match(numbers)||[]);
  if(rawAmounts.length){
   name=line.replace(numbers,' ').replace(/[—–]/g,' ').replace(/[()]/g,' ').replace(/\s+/g,' ').trim();
  }
  let field=canonicalField(name);
  // The profit figure in the cash-flow statement is reconciliation evidence
  // and must not be mistaken for a conflicting income-statement entry.
  if(statementSection==='cash_flow'&&field==='net_income')
    field='cash_flow_net_income';
  if(!field && isCell(line))continue;
  // Ignore unrelated lines; do not infer a number from a nearby caption.
  if(!field||!wanted.has(field))continue;
  let cells=[];
  let context=line;
  let sourceLine=index+1;
  if(rawAmounts.length && rawAmounts.length<=2) {
   // Recover blanks represented as em dashes while preserving column order.
   const left=line.replace(name,'').trim();
   const separators=(left.match(/\(?[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\)?|[—–]/g)||[]);
   cells=separators.length===2?separators:rawAmounts;
   // Preserve the established contract for a single explicitly dated amount:
   // "Revenue 2026 1000000" contains one amount, not two columns.
   if(financialAnalysisMode && rawAmounts.length===2 &&
      /^20\d{2}$/.test(rawAmounts[0]) && !/^20\d{2}$/.test(rawAmounts[1])) {
    cells=[rawAmounts[1]];
   }
  } else if(!rawAmounts.length && isCell(lines[index+1])){
   // A real PDF in RTL uses one text item per row: LABEL, CURRENT, PRIOR.
   // A missing amount is represented by an em dash; never shift periods.
   cells=[clean(lines[index+1])];
   if(isCell(lines[index+2]))cells.push(clean(lines[index+2]));
  }
  if(!cells.length)continue;
  const hasPeriods=financialAnalysisMode&&datedColumns&&index>datedColumns.at;
  // One amount with no year is safe only for single-column financial data.
  // Two amounts without a dated header are preserved as a conflict.
  if(cells.length===1){
   const hit=candidate(field,cells[0],context,{extraction_method:'text_parser',line:sourceLine,label:name,
    ...(hasPeriods?{period:datedColumns.periods[0],header_line:datedColumns.at+1}: {})});
   if(hit){if(hasPeriods)hit.period=datedColumns.periods[0];found.push(applyTextHeading(hit));}
  }else if(cells.length===2){
   // An explicit comparative header with no latest-period amount must remain
   // unresolved. Do not promote an older year's sole amount to current.
   if(hasPeriods) {
    const latest=[...datedColumns.periods].sort((a,b)=>Number(b)-Number(a))[0];
    const latestIndex=datedColumns.periods.indexOf(latest);
    if(parseNumeric(cells[latestIndex])===null &&
       cells.some((v,i)=>i!==latestIndex&&parseNumeric(v)!==null)) {
      found.push({field,value:null,period:latest,currency:null,confidence:0,
       provenance:{extraction_method:'text_parser',line:sourceLine,
        column:latestIndex+1,period:latest,header_line:datedColumns.at+1}});
    }
   }
   cells.forEach((amount,col)=>{
    const hit=candidate(field,amount,context,{extraction_method:'text_parser',line:sourceLine,label:name,
      column:col+1,...(hasPeriods?{period:datedColumns.periods[col],header_line:datedColumns.at+1}: {})});
    if(hit){if(hasPeriods)hit.period=datedColumns.periods[col];found.push(applyTextHeading(hit));}
   });
  }
 }
 return found;
}

function resolveCandidates(found,financialAnalysisMode=false) {
 const byField=new Map();
 for(const hit of found){
  if(!byField.has(hit.field))byField.set(hit.field,[]);
  byField.get(hit.field).push(hit);
 }
 const values={},fields=[],provenance={};
 for(const [field,rawHits] of byField){
  // Explicit operating-expense subtotals already include their listed components.
  // When available for a period, prefer the subtotal without double counting.
  let hits=rawHits;
  if(field==='operating_expenses'){
    const isSubtotal=hit=>{
      const words=normalizeLabel(hit.provenance?.label).split(/\s+/);
      return words.includes('مجموع')&&words.includes('المصروفات')&&
        words.includes('العمومية')&&words.some(word=>/[اإأ]دارية/.test(word));
    };
    const subtotalPeriods=new Set(rawHits.filter(isSubtotal).map(hit=>hit.period||'UNSPECIFIED'));
    if(subtotalPeriods.size)
      hits=rawHits.filter(hit=>!subtotalPeriods.has(hit.period||'UNSPECIFIED')||isSubtotal(hit));
  }
  const unique=[...new Set(hits.map(hit=>hit.value))];
  const groups={};
  for(const hit of hits){
   const period=hit.period||'UNSPECIFIED';
   if(!groups[period])groups[period]=[];
   groups[period].push(hit.value);
  }
  const named=Object.keys(groups).filter(period=>period!=='UNSPECIFIED');
  const periodValues=Object.fromEntries(Object.entries(groups).map(([period,numbers])=>[
   period,[...new Set(numbers)].length===1?[...new Set(numbers)][0]:null
  ]));
  const multi=named.length>1;
  const sorted=named.filter(p=>/^20\d{2}$/.test(p)).sort((a,b)=>Number(b)-Number(a));
  const latest=sorted[0]||null;
  const unlabelled=groups.UNSPECIFIED||[];
  const canChoose=financialAnalysisMode&&multi&&sorted.length===named.length&&
   sorted.every(period=>periodValues[period]!==null)&&
   unlabelled.every(value=>value===periodValues[latest]);
  const conflict=!multi&&unique.length>1;
  const status=canChoose?'extracted_multi_period':multi?'multi_period':conflict?'conflict':'extracted';
  const value=canChoose?periodValues[latest]:(conflict||multi?null:unique[0]);
  if(value!==null&&value!==undefined)values[field]=value;
  fields.push({
   field,value:value??null,status,
   candidates:(conflict||multi)?hits.map(hit=>({value:hit.value,period:hit.period||null,currency:hit.currency||null,source:hit.provenance||null})):[],
   period_values:multi?periodValues:{},
   confidence:value===null?0:Math.max(...hits.map(hit=>Number(hit.confidence)||0)),
   currency:[...new Set(hits.map(hit=>hit.currency).filter(Boolean))][0]||null,
   period:canChoose?latest:multi?null:([ ...new Set(hits.map(hit=>hit.period).filter(Boolean))][0]||null),
   source:hits.map(hit=>hit.provenance)
  });
  provenance[field]=hits.map(hit=>hit.provenance);
 }
 // Comparative metrics are inserted only from EXPLICIT year-column headers.
 // Never invent a prior year when no dated source column exists.
 if(financialAnalysisMode){
  for(const [current,prior] of [['revenue','prior_revenue'],['net_income','prior_net_income']]){
   const source=fields.find(item=>item.field===current&&item.status==='extracted_multi_period');
   if(!source||Object.prototype.hasOwnProperty.call(values,prior))continue;
   const periods=Object.keys(source.period_values).filter(p=>/^20\d{2}$/.test(p)).sort((a,b)=>Number(b)-Number(a));
   if(periods.length<2)continue;
   const previous=periods[1],amount=source.period_values[previous];
   if(typeof amount!=='number'||!Number.isFinite(amount))continue;
   values[prior]=amount;
   const relevant=(byField.get(current)||[]).filter(hit=>hit.period===previous);
   const field={field:prior,value:amount,status:'extracted_comparative',candidates:[],
    period:previous,period_values:{[previous]:amount},
    confidence:Math.max(...relevant.map(hit=>Number(hit.confidence)||0)),
    currency:source.currency,source:relevant.map(hit=>hit.provenance)};
   fields.push(field);
   provenance[prior]=field.source;
  }
 }
 return {values,fields,provenance};
}

function engineCodeForAction(action) {
  return ACTION_ENGINE[String(action||'').trim()] || null;
}

function requirementFields(requiredInputs) {
  const wanted=new Set();
  for(const item of Array.isArray(requiredInputs)?requiredInputs:[]){
    if(REQUIRED_ALTERNATIVES[item]){
      REQUIRED_ALTERNATIVES[item].forEach(x=>wanted.add(x));
      continue;
    }
    if(item.startsWith('non_zero_')) { wanted.add(item.slice(9)); continue; }
    if(item.startsWith('non_negative_')) { wanted.add(item.slice(13)); continue; }
    if(item==='positive_total_capital') { wanted.add('total_debt'); wanted.add('equity'); continue; }
    if(item==='periods') { wanted.add('periods'); continue; }
    if(ALL_FIELDS.includes(item)) wanted.add(item);
  }
  return [...wanted];
}

function requirementsFor({ primaryAction, serviceCode, values={} }) {
  const serviceProfile=SERVICE_INTAKE_PROFILES[String(serviceCode||'').trim()];
  if(serviceProfile){
    const required=[...new Set(serviceProfile.required || [])];
    const fields=[...new Set([...(serviceProfile.fields || []), ...required])];
    const missing=required.filter(field => {
      const value=values?.[field];
      return value===null || value===undefined || value==='';
    });
    return {
      supported:true,
      engine_code:null,
      required_inputs:missing,
      requirement_fields:fields,
      engine_result:null,
      intake_profile:'tax_zakat'
    };
  }
  const engineCode=engineCodeForAction(primaryAction);
  if(!engineCode) return { supported:false, engine_code:null, required_inputs:[], requirement_fields:[] };
  const result=runFinancialEngine(engineCode,values,{serviceCode});
  return {
    supported:true,
    engine_code:engineCode,
    required_inputs:result.required_inputs || [],
    requirement_fields:serviceCode==='financial_analysis' ? FINANCIAL_ANALYSIS_FIELDS : requirementFields(result.required_inputs || []),
    engine_result:result
  };
}

function extractFinancialFields({ parsed, primaryAction, serviceCode }) {
  const requirements=requirementsFor({primaryAction,serviceCode,values:{}});
  if(!requirements.supported) return { ...requirements, values:{}, fields:[], provenance:{} };
  // A comprehensive financial analysis needs all recognized source fields, not
  // only the three fields required for the initial liquidity gate.
  const wanted=new Set(serviceCode==='financial_analysis' ? FINANCIAL_ANALYSIS_FIELDS : requirements.requirement_fields);
  const isAnalysis=serviceCode==='financial_analysis';
  const worksheetTables=isAnalysis && Array.isArray(parsed?.sheets) ? parsed.sheets : [];
  const tableHits=worksheetTables.length
    ? worksheetTables.flatMap(sheet=>extractFromRows(sheet.rows,sheet.name,wanted,true,sheet.page))
    : extractFromRows(parsed?.rows,parsed?.sheet_name,wanted,isAnalysis);
  // A table detector may find only part of a statement. Use independent
  // textual fallback for fields that do not have tabular source evidence;
  // never let an undated text duplicate override a dated table column.
  // A PDF table may contain only an undated, ambiguous amount. Allow
  // text fallback to recover such fields, without overwriting trusted dates.
  const verifiedTables=resolveCandidates(tableHits,isAnalysis);
  const verifiedFields=new Set(verifiedTables.fields.filter(field=>
    field.status==='extracted_multi_period' ||
    (field.status==='extracted' && field.period)
  ).map(field=>field.field));
  const textWanted=new Set([...wanted].filter(field=>!verifiedFields.has(field)));
  const found=[...tableHits,...extractFromText(parsed?.text,textWanted,isAnalysis)];
  const resolved=resolveCandidates(found,serviceCode==='financial_analysis');
  if(isAnalysis){
    const text=arabicDigitsToAscii(String(parsed?.text||'')).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c]/g,'');
    const disclaimer=/أرقام عام\s*20\d{2}\s*مبنية على افتراضات|لا تمثل قوائم مالية معتمدة|unaudited|not audited|pro forma/i.test(text) ||
      text.split(/\r?\n/).some(line=>
        /افتراضات/.test(line)&&/غير/.test(line)&&/مثبتة/.test(line)&&/معتمدة/.test(line));
    if(disclaimer)resolved.fields.forEach(row=>{row.document_disclaimer='source_figures_unverified';});
    // Some Arabic PDF extractors reverse the entire header token sequence.
    // Require both full-year and nine-month captions with explicit distinct years.
    const dateHeader=text.split(/\r?\n/).find(line=>
      /(?:التسعة\s+أشهر|أشهر\s+التسعة|9\s+أشهر)/.test(line) &&
      /(?:السنة\s+المنتهية|المنتهية\s+بالسنة)/.test(line) &&
      new Set([...line.matchAll(/\b20\d{2}\b/g)].map(match=>match[0])).size>=2);
    const datedYears=dateHeader?[...new Set([...dateHeader.matchAll(/\b20\d{2}\b/g)].map(match=>match[0]))].sort():[];
    const currentPeriod=datedYears.at(-1);
    const annualPeriod=datedYears[0];
    if(currentPeriod&&annualPeriod&&currentPeriod!==annualPeriod){
      for(const name of ['prior_revenue','prior_net_income']){
        const row=resolved.fields.find(item=>item.field===name&&item.period===annualPeriod);
        if(!row)continue;
        row.comparison_excluded=true;
        row.comparison_reason='unequal_reporting_duration';
        row.comparison_months={current:9,prior:12};
        row.status='not_comparable';
        delete resolved.values[name];
      }
    }
  }
  const validation=validateDataset({
    primaryAction,
    serviceCode,
    values:resolved.values,
    fields:resolved.fields
  });
  const fieldMap=new Map(resolved.fields.map(f=>[f.field,f]));
  const reviewFields=[...wanted].map(field => fieldMap.get(field) || {
    field,value:null,status:'missing',candidates:[],currency:null,period:null,source:[]
  });
  return { ...requirements, ...resolved, fields:reviewFields, validation };
}

// Derive only identities determined by already observed figures. Each result
// remains traceable and is never allowed to overwrite an explicit input.
function deriveFinancialInputs(values={}, fields=[]) {
  const supplied={...values};
  const rows=(Array.isArray(fields)?fields:[]).map(field=>({...field}));
  const previousDerived=new Set(rows.filter(f=>f.status==='derived').map(f=>f.field));
  for (const field of previousDerived) delete supplied[field];
  const activeRows=rows.filter(f=>f.status!=='derived');
  const number=field=>typeof supplied[field]==='number'&&Number.isFinite(supplied[field]) ? supplied[field] : null;
  const rules=[
    ['equity',['total_assets','total_liabilities'],(a,l)=>a-l,'equity = total_assets - total_liabilities'],
    ['total_liabilities',['total_assets','equity'],(a,e)=>a-e,'total_liabilities = total_assets - equity'],
    ['total_assets',['total_liabilities','equity'],(l,e)=>l+e,'total_assets = total_liabilities + equity'],
    ['operating_income',['revenue','cogs','operating_expenses'],(r,c,o)=>r-c-o,'operating_income = revenue - cogs - operating_expenses'],
    ['ebitda',['operating_income','depreciation_amortization'],(operating,da)=>operating+da,'ebitda = operating_income + depreciation_amortization'],
    ['ending_cash',['opening_balance','operating_cash_flow','investing_cash_flow','financing_cash_flow'],(opening,operating,investing,financing)=>opening+operating+investing+financing,'ending_cash = opening_balance + operating_cash_flow + investing_cash_flow + financing_cash_flow']
  ];
  const derived=[];
  for(const [field,inputs,compute,formula] of rules){
    if(number(field)!==null)continue;
    // An ambiguous source value must be reviewed, not replaced by inference.
    if(activeRows.some(row=>row.field===field&&['conflict','multi_period'].includes(row.status)))continue;
    const args=inputs.map(number);
    if(args.some(x=>x===null))continue;
    // Do not derive a financial statement amount from mixed periods or currencies.
    const sourceRows=inputs.map(key=>activeRows.find(row=>row.field===key));
    if(sourceRows.some(row=>row && ['conflict','multi_period'].includes(row.status)))continue;
    // Manual-only inputs may have no field metadata at all; never treat
    // absence of source rows as a conflict unless some inputs are dimensioned.
    const periodKeys=sourceRows.map(row=>row?.period||null);
    const currencyKeys=sourceRows.map(row=>row?.currency||null);
    const periods=[...new Set(periodKeys.filter(Boolean))];
    const currencies=[...new Set(currencyKeys.filter(Boolean))];
    if(periods.length>1 || currencies.length>1 ||
       (periods.length && periodKeys.some(value=>!value)) ||
       (currencies.length && currencyKeys.some(value=>!value)))continue;
    const amount=compute(...args);
    if(!Number.isFinite(amount))continue;
    supplied[field]=amount;
    const item={field,value:amount,status:'derived',candidates:[],currency:currencies[0]||null,period:periods[0]||null,
      confidence:1,formula,depends_on:inputs,
      source:[{extraction_method:'deterministic_derivation',formula,depends_on:inputs}]};
    derived.push(item);
    const missingIndex=activeRows.findIndex(row=>row.field===field&&row.status==='missing');
    if(missingIndex>=0)activeRows.splice(missingIndex,1,item);
    else activeRows.push(item);
  }
  return {values:supplied,fields:activeRows,derived};
}

function validateDataset({ primaryAction, serviceCode, values={}, fields=[] }) {
  const requirements=requirementsFor({primaryAction,serviceCode,values});
  const errors=[], warnings=[];
  for(const [key,value] of Object.entries(values||{})){
    if(key==='periods') {
      if(!Array.isArray(value) || !value.length) errors.push({code:'INVALID_PERIODS',field:key});
      continue;
    }
    if(value!==null && value!==undefined && !Number.isFinite(Number(value))) errors.push({code:'INVALID_NUMBER',field:key});
  }
  const currencies=[...new Set(fields.map(f=>f.currency).filter(Boolean))];
  if(serviceCode==='financial_analysis'){
    if(fields.some(field=>field.document_disclaimer==='source_figures_unverified'))
      warnings.push({code:'FINANCIAL_SOURCE_UNVERIFIED'});
    const blocked=fields.filter(field=>field.comparison_excluded===true);
    if(blocked.length){
      warnings.push({code:'COMPARATIVE_PERIOD_DURATION_MISMATCH',
        fields:blocked.map(field=>field.field),current_months:9,prior_months:12});
      for(const field of blocked){
        if(typeof values[field.field]==='number'&&Number.isFinite(values[field.field]))
          errors.push({code:'INCOMPARABLE_GROWTH_INPUT',field:field.field});
      }
    }
  }
  const periods=[...new Set(fields.filter(f=>!['prior_revenue','prior_net_income'].includes(f.field)).map(f=>f.period).filter(Boolean))];
  const activeRequiredFields=new Set(requirementFields(requirements.required_inputs || []));
  const unresolved=fields
    .filter(f=>activeRequiredFields.has(f.field) && ['missing','conflict','multi_period'].includes(f.status))
    .map(f=>({field:f.field,status:f.status}));
  if(currencies.length>1) errors.push({code:'CURRENCY_MISMATCH',values:currencies});
  if(periods.length>1) warnings.push({code:'PERIOD_MISMATCH',values:periods});
  if(['total_assets','total_liabilities','equity'].every(k=>Number.isFinite(Number(values[k])))){
    const assets=Number(values.total_assets), rhs=Number(values.total_liabilities)+Number(values.equity);
    const tolerance=Math.max(1,Math.abs(assets)*0.005);
    const difference=assets-rhs;
    if(Math.abs(difference)>tolerance) {
      warnings.push({
        code:'ACCOUNTING_EQUATION_MISMATCH',
        difference,
        tolerance,
        material:true
      });
    }
  }
  if(Number.isFinite(Number(values.cash)) && Number.isFinite(Number(values.ending_cash))){
    const balanceCash=Number(values.cash), flowCash=Number(values.ending_cash);
    const tolerance=Math.max(1,Math.max(Math.abs(balanceCash),Math.abs(flowCash))*0.005);
    if(Math.abs(balanceCash-flowCash)>tolerance) warnings.push({
      code:'CROSS_STATEMENT_CASH_MISMATCH',
      balance_sheet_cash:balanceCash,
      cash_flow_ending_cash:flowCash,
      difference:balanceCash-flowCash,
      tolerance,
      material:true
    });
  }
  if(Number.isFinite(Number(values.net_income)) && Number.isFinite(Number(values.cash_flow_net_income))){
    const income=Number(values.net_income), flowIncome=Number(values.cash_flow_net_income);
    const tolerance=Math.max(1,Math.max(Math.abs(income),Math.abs(flowIncome))*0.005);
    if(Math.abs(income-flowIncome)>tolerance) warnings.push({
      code:'CROSS_STATEMENT_NET_INCOME_MISMATCH',
      income_statement_net_income:income,
      cash_flow_net_income:flowIncome,
      difference:income-flowIncome,
      tolerance,
      material:true
    });
  }
  if(serviceCode==='financial_analysis'){
    const present=key=>typeof values[key]==='number'&&Number.isFinite(values[key]);
    const accountingPairs=[
      {keys:['total_assets','total_liabilities','equity'],code:'ACCOUNTING_EQUATION_MISMATCH',eval:()=>values.total_assets-values.total_liabilities-values.equity,
       scale:()=>Math.abs(values.total_assets)},
      {keys:['total_debt','total_liabilities'],code:'DEBT_EXCEEDS_TOTAL_LIABILITIES',eval:()=>values.total_debt-values.total_liabilities,
       scale:()=>Math.abs(values.total_liabilities)},
      {keys:['operating_income','ebitda'],code:'EBIT_EXCEEDS_EBITDA',eval:()=>values.operating_income-values.ebitda,
       scale:()=>Math.max(Math.abs(values.operating_income),Math.abs(values.ebitda))},
      {keys:['revenue','cogs','operating_expenses','operating_income'],code:'OPERATING_PROFIT_RECONCILIATION_MISMATCH',
       eval:()=>values.operating_income-(values.revenue-values.cogs-values.operating_expenses),
       scale:()=>Math.abs(values.revenue)}
    ];
    for(const rule of accountingPairs){
      if(!rule.keys.every(present))continue;
      const difference=rule.eval();
      const tolerance=Math.max(1,rule.scale()*0.005);
      // The one-sided debt/EBIT comparisons are consistent when negative.
      if(difference>tolerance || (rule.code==='ACCOUNTING_EQUATION_MISMATCH'||rule.code==='OPERATING_PROFIT_RECONCILIATION_MISMATCH')&&Math.abs(difference)>tolerance){
        errors.push({code:rule.code,difference,tolerance,fields:rule.keys});
      }
    }
  }
  if(serviceCode==='financial_analysis'){
    const present=key=>typeof values[key]==='number'&&Number.isFinite(values[key]);
    const addMismatch=(code,keys,actual,expected)=>{
      const difference=actual-expected;
      const tolerance=Math.max(1,Math.abs(expected)*0.005);
      if(Math.abs(difference)>tolerance)errors.push({code,fields:keys,difference,tolerance});
    };
    if(['opening_balance','operating_cash_flow','investing_cash_flow','financing_cash_flow','ending_cash'].every(present)){
      addMismatch('CASH_FLOW_RECONCILIATION_MISMATCH',
        ['opening_balance','operating_cash_flow','investing_cash_flow','financing_cash_flow','ending_cash'],
        values.ending_cash,values.opening_balance+values.operating_cash_flow+
        values.investing_cash_flow+values.financing_cash_flow);
    }
    if(['ending_cash','cash'].every(present)){
      addMismatch('CROSS_STATEMENT_CASH_MISMATCH',['ending_cash','cash'],values.ending_cash,values.cash);
    }
    if(['cash_flow_net_income','net_income'].every(present)){
      addMismatch('CROSS_STATEMENT_NET_INCOME_MISMATCH',
        ['cash_flow_net_income','net_income'],values.cash_flow_net_income,values.net_income);
    }
    const equityMovement=auditEquityRollForward(values);
    if(equityMovement.status==='FAIL'){
      errors.push({code:'EQUITY_ROLL_FORWARD_MISMATCH',
        fields:equityMovement.fields,difference:equityMovement.difference,
        tolerance:equityMovement.tolerance});
    }else if(equityMovement.status==='UNVERIFIED'){
      warnings.push({code:'EQUITY_ROLL_FORWARD_UNVERIFIED',missing:equityMovement.missing,
        material:false});
    }
    if(['ebitda','operating_income','depreciation_amortization'].every(present)){
      addMismatch('EBITDA_RECONCILIATION_MISMATCH',
        ['ebitda','operating_income','depreciation_amortization'],values.ebitda,
        values.operating_income+values.depreciation_amortization);
    }
  }
  const valid=errors.length===0 && requirements.required_inputs.length===0 && unresolved.length===0;
  return {
    valid,
    quality_gate: valid ? 'PASS' : 'FAIL_CLOSED',
    errors,
    warnings,
    unresolved,
    missing:requirements.required_inputs,
    engine_preview:requirements.engine_result
  };
}

function classifyDocumentType(parsed={}) {
  const sample=[
    String(parsed?.text || '').slice(0,20000),
    ...(Array.isArray(parsed?.rows) ? parsed.rows.slice(0,80).map(row=>Array.isArray(row)?row.join(' '):String(row||'')) : [])
  ].join('\n');
  for(const [type,pattern] of DOCUMENT_TYPE_HINTS){
    if(pattern.test(sample)) return type;
  }
  return 'unknown';
}

function fieldConfidenceMap(fields=[]) {
  return Object.fromEntries((Array.isArray(fields)?fields:[]).map(field=>{
    if(field.status==='corrected' || field.status==='manual') return [field.field,1];
    if(['missing','conflict','multi_period'].includes(field.status)) return [field.field,0];
    const explicit=Number(field.confidence);
    if(Number.isFinite(explicit)) return [field.field,Math.max(0,Math.min(1,explicit))];
    const methods=(field.source||[]).map(source=>source?.extraction_method);
    return [field.field,methods.includes('manual_input')?1:methods.includes('tabular_parser')?0.95:methods.includes('text_parser')?0.85:0];
  }));
}

function financialStatementCoverage(values={}){
  const groups={
    income_statement:['revenue','cogs','operating_expenses','net_income'],
    financial_position:['total_assets','total_liabilities','equity','current_assets','current_liabilities'],
    cash_flow:['opening_balance','operating_cash_flow','investing_cash_flow','financing_cash_flow','ending_cash','cash']
  };
  const complete=group=>group.every(field=>typeof values[field]==='number'&&Number.isFinite(values[field]));
  const statement_status=Object.fromEntries(Object.entries(groups).map(([key,keys])=>[
    key,{status:complete(keys)?'COMPLETE':'PARTIAL',missing:keys.filter(field=>typeof values[field]!=='number'||!Number.isFinite(values[field]))}
  ]));
  return {
    statement_status,
    overall_complete:Object.values(statement_status).every(x=>x.status==='COMPLETE'),
    required_groups:Object.keys(groups)
  };
}
function qualityStatus({ validation={}, fields=[], reviewed=false, serviceCode=null, values={} }={}) {
  const unresolved=Array.isArray(validation.unresolved) ? validation.unresolved : [];
  if(unresolved.some(field=>['conflict','multi_period'].includes(field.status))) return 'conflicting';
  if((validation.missing||[]).length || unresolved.some(field=>field.status==='missing')) return 'partial';
  if(validation.valid!==true) return 'unverified';
  if(serviceCode==='financial_analysis'&&fields.some(field=>field.document_disclaimer==='source_figures_unverified'))return 'unverified';
  // A 3-input liquidity calculation must not be labeled as a fully verified
  // three-statement financial analysis.
  if(serviceCode==='financial_analysis'&&!financialStatementCoverage(values).overall_complete)return 'partial';
  return reviewed ? 'verified' : 'complete';
}

function stableInputHash(values={}) {
  const normalized=Object.fromEntries(
    Object.entries(values && typeof values==='object' && !Array.isArray(values) ? values : {})
      .sort(([a],[b])=>a.localeCompare(b))
  );
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function buildDependencyGraph({ requirementFields=[], serviceCode=null, engineCode=null }={}) {
  const target=engineCode ? 'engine:'+engineCode : serviceCode ? 'service:'+serviceCode : 'service:unknown';
  return {
    inputs:[...new Set(requirementFields||[])],
    service_code:serviceCode,
    engine_code:engineCode,
    edges:[...new Set(requirementFields||[])].map(field=>({
      from:'input:'+field,
      to:target,
      type:'required_input'
    })).concat(engineCode && serviceCode ? [{
      from:'engine:'+engineCode,
      to:'service:'+serviceCode,
      type:'produces_result'
    }] : [])
  };
}

module.exports={
  ACTION_ENGINE,
  FIELD_DICTIONARY,
  SERVICE_INTAKE_PROFILES,
  ALL_FIELDS,
  canonicalField,
  parseNumeric,
  deriveFinancialInputs,
  requirementsFor,
  extractFinancialFields,
  validateDataset,
  classifyDocumentType,
  fieldConfidenceMap,
  qualityStatus,
  financialStatementCoverage,
  stableInputHash,
  buildDependencyGraph
};
