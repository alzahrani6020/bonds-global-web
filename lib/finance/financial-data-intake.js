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
  equity: ['equity','total equity',"shareholders equity","shareholders' equity",'حقوق الملكية','إجمالي حقوق الملكية','اجمالي حقوق الملكية'],
  total_assets: ['total assets','إجمالي الأصول','اجمالي الأصول'],
  total_liabilities: ['total liabilities','إجمالي الالتزامات','اجمالي الالتزامات'],
  current_assets: ['current assets','الأصول المتداولة','الاصول المتداولة'],
  current_liabilities: ['current liabilities','الالتزامات المتداولة'],
  cash: ['cash','cash and cash equivalents','النقد','النقد وما في حكمه'],
  revenue: ['revenue','sales revenue','الإيرادات','الايرادات'],
  cogs: ['cost of goods sold','cost of sales','cogs','تكلفة المبيعات'],
  operating_expenses: ['operating expenses','opex','المصروفات التشغيلية'],
  total_expenses: ['total expenses','total expense','expenses','إجمالي المصروفات','اجمالي المصروفات','المصروفات'],
  operating_income: ['operating income','operating profit','الربح التشغيلي'],
  net_income: ['net income','net profit','صافي الربح'],
  ebitda: ['ebitda'],
  depreciation_amortization: ['depreciation and amortization','depreciation amortization','d&a','الإهلاك والإطفاء','الاهلاك والاطفاء','الإهلاك والاطفاء'],
  operating_cash_flow: ['operating cash flow','net cash from operating activities','التدفقات النقدية التشغيلية','صافي التدفقات النقدية التشغيلية'],
  investing_cash_flow: ['investing cash flow','net cash from investing activities','التدفقات النقدية الاستثمارية'],
  financing_cash_flow: ['financing cash flow','net cash from financing activities','التدفقات النقدية التمويلية'],
  scheduled_debt_service: ['scheduled debt service','principal and interest due','أقساط وخدمة الدين المستحقة','خدمة الدين المستحقة'],
  cash_available_for_debt_service: ['cash available for debt service','cfads','النقد المتاح لخدمة الدين','التدفق النقدي المتاح لخدمة الدين'],
  payables: ['accounts payable','trade payables','الذمم الدائنة','الدائنون التجاريون'],
  one_off_income: ['non recurring income','non-recurring income','one off income','الدخل غير المتكرر','الأرباح غير المتكررة'],
  interest_expense: ['interest expense','finance cost','مصروف الفوائد','تكلفة التمويل'],
  inventory: ['inventory','المخزون'],
  receivables: ['receivables','accounts receivable','الذمم المدينة','المدينون'],
  prior_revenue: ['prior revenue','previous revenue','إيرادات الفترة السابقة','ايرادات الفترة السابقة'],
  prior_net_income: ['prior net income','previous net income','صافي ربح الفترة السابقة'],
  cost_of_equity_pct: ['cost of equity','cost of equity %','تكلفة حقوق الملكية','تكلفة حقوق الملكية %'],
  cost_of_debt_pct: ['cost of debt','cost of debt %','تكلفة الدين','تكلفة الدين %'],
  tax_rate_pct: ['tax rate','tax rate %','معدل الضريبة','معدل الضريبة %'],
  opening_balance: ['opening balance','opening cash balance','الرصيد الافتتاحي','رصيد افتتاحي'],
  ending_cash: ['ending cash','ending cash balance','cash at end of period','النقد في نهاية الفترة','الرصيد النقدي الختامي'],
  cash_flow_net_income: ['net income per cash flow','cash flow net income','صافي الربح بقائمة التدفقات','صافي الدخل بقائمة التدفقات'],
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
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[：:؛;,.،]/g, ' ')
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
  for (const [key, aliases] of Object.entries(NORMALIZED_ALIASES)) {
    if (aliases.has(normalized)) return key;
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
  const negative = /^\(.*\)$/.test(raw);
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
  if (/\bSAR\b|ر\.?\s?س|ريال\s+سعودي/i.test(text)) return 'SAR';
  if (/\bUSD\b|دولار\s+(?:أمريكي|امريكي)|\$/i.test(text)) return 'USD';
  if (/\bEUR\b|يورو|€/i.test(text)) return 'EUR';
  if (/\bEGP\b|جنيه\s+مصري/i.test(text)) return 'EGP';
  if (/\bAED\b|درهم\s+إماراتي/i.test(text)) return 'AED';
  return null;
}

function detectUnit(value) {
  const text=String(value ?? '').toLowerCase();
  if (/\bmillions?\b|مليون/.test(text)) return { unit:'million', multiplier:1_000_000 };
  if (/\bthousands?\b|ألف|الف/.test(text)) return { unit:'thousand', multiplier:1_000 };
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
    value:numeric * unit.multiplier,
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
  const first=normalizeLabel(cells[0]);
  if(first&&!/^(description|account|particulars|item|year|البيان|البند|الوصف|الحساب|السنوات)$/.test(first))continue;
  const years=cells.map((cell,col)=>{
   const text=arabicDigitsToAscii(cell).trim();
   const match=text.match(/^(20\d{2})\s*(?:م|AD)?$/i);
   return match?{column:col,period:match[1]}:null;
  }).filter(Boolean);
  if(years.length>=2&&new Set(years.map(y=>y.period)).size===years.length){
   return {rowIndex,years:years.sort((a,b)=>Number(b.period)-Number(a.period))};
  }
 }
 return null;
}
function extractFromRows(rows, sheetName, wanted, financialAnalysisMode=false) {
 const found=[];
 const sourceRows=Array.isArray(rows)?rows:[];
 const columns=financialAnalysisMode?tabularYearColumns(sourceRows):null;
 sourceRows.forEach((row,rowIndex)=>{
  const cells=Array.isArray(row)?row:[];
  for(let col=0;col<cells.length;col++){
   const field=canonicalField(cells[col]);
   if(!field||!wanted.has(field))continue;
   if(columns&&rowIndex>columns.rowIndex&&col<Math.min(...columns.years.map(y=>y.column))){
    const latest=columns.years[0];
    // If the current period is blank, never silently use the preceding year.
    if(parseNumeric(cells[latest.column])===null)continue;
    for(const year of columns.years){
     const hit=candidate(field,cells[year.column],String(cells[col])+' '+year.period,{
      extraction_method:'tabular_parser',sheet:sheetName||null,
      row:rowIndex+1,column:year.column+1,period:year.period
     });
     if(hit){hit.period=year.period;found.push(hit);}
    }
    continue;
   }
   // A table without a year header cannot prove which numeric column is current.
   const following=financialAnalysisMode&&!columns
    ?cells.slice(col+1,col+4).map((value,offset)=>({value,column:col+offset+2})).filter(x=>parseNumeric(x.value)!==null)
    :[{value:cells[col+1],column:col+2}];
   for(const next of following){
    const context=cells.slice(Math.max(0,col-1),Math.min(cells.length,col+4)).join(' ');
    const hit=candidate(field,next.value,context,{
     extraction_method:'tabular_parser',sheet:sheetName||null,
     row:rowIndex+1,column:next.column
    });
    if(hit)found.push(hit);
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
  const lines=String(text||'').split(/\r?\n/);
  let datedColumns=null;
  const numberPattern=/\(?[+-]?(?:\d{1,3}(?:[,\u066C]\d{3})+|\d+)(?:[.\u066B]\d+)?\)?/g;
  lines.forEach((line,index)=>{
    const normalizedLine=normalizeLabel(line);
    const ascii=arabicDigitsToAscii(line);
    if(financialAnalysisMode) {
      // Require an explicit column label: a year in a page footer is not a header.
      const header=ascii.trim().match(/^(?:البيان|البند|الوصف|الحساب|description|particulars|item|account)\s*[:\-]?\s+(20\d{2})(?:\s*م)?\s+(20\d{2})(?:\s*م)?\s*$/i);
      if(header && header[1]!==header[2]) {
        datedColumns={periods:[header[1],header[2]],at:index};
        return;
      }
      // Never carry column meaning across an entire PDF without a new header.
      if(datedColumns && index-datedColumns.at>40) datedColumns=null;
    }
    for(const field of wanted){
      for(const alias of NORMALIZED_ALIASES[field] || []){
        if(!normalizedLine.startsWith(alias+' ') && normalizedLine!==alias) continue;
        const tokens=ascii.match(numberPattern)||[];
        const amounts=tokens.filter(token=>!/^20\d{2}$/.test(token.trim()));
        // A single value stays undated unless the source line itself dates it.
        // Distinct multiple values without a dated header must NOT become a guess.
        if(amounts.length===1) {
          const hit=candidate(field,amounts[0],line,{
            extraction_method:'text_parser',line:index+1
          });
          if(hit)found.push(hit);
        } else if(financialAnalysisMode && amounts.length===2) {
          const periods=datedColumns && index>datedColumns.at ? datedColumns.periods : null;
          amounts.forEach((amount,column)=>{
            const hit=candidate(field,amount,line,{
              extraction_method:'text_parser',line:index+1,column:column+1,
              ...(periods ? {period:periods[column],header_line:datedColumns.at+1} : {})
            });
            if(hit){
              if(periods)hit.period=periods[column];
              found.push(hit);
            }
          });
        }
        break;
      }
    }
  });
  return found;
}

function resolveCandidates(found,financialAnalysisMode=false) {
 const byField=new Map();
 for(const hit of found){
  if(!byField.has(hit.field))byField.set(hit.field,[]);
  byField.get(hit.field).push(hit);
 }
 const values={},fields=[],provenance={};
 for(const [field,hits] of byField){
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
   candidates:(conflict||multi&&!canChoose)?hits.map(hit=>({value:hit.value,period:hit.period||null})):[],
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
  const workbookSheets=isAnalysis && Array.isArray(parsed?.sheets) ? parsed.sheets : [];
  const found=workbookSheets.length
    ? workbookSheets.flatMap(sheet=>extractFromRows(sheet.rows,sheet.name,wanted,true))
    : [
      ...extractFromRows(parsed?.rows,parsed?.sheet_name,wanted,isAnalysis),
      ...extractFromText(parsed?.text,wanted,isAnalysis)
    ];
  const resolved=resolveCandidates(found,serviceCode==='financial_analysis');
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
    const amount=compute(...args);
    if(!Number.isFinite(amount))continue;
    supplied[field]=amount;
    const item={field,value:amount,status:'derived',candidates:[],currency:null,period:null,
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
