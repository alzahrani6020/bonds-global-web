'use strict';

const crypto = require('crypto');
const { runFinancialEngine } = require('./financial-engine-registry');

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
  operating_income: ['operating income','operating profit','الربح التشغيلي'],
  net_income: ['net income','net profit','صافي الربح'],
  ebitda: ['ebitda'],
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
  cash_flow_net_income: ['net income per cash flow','cash flow net income','صافي الربح بقائمة التدفقات','صافي الدخل بقائمة التدفقات']
});

const ALL_FIELDS = Object.freeze(Object.keys(FIELD_DICTIONARY));
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
  ['financial_report', /financial report|financial statements|تقرير مالي|القوائم المالية/i]
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

function extractFromRows(rows, sheetName, wanted) {
  const found=[];
  (Array.isArray(rows)?rows:[]).forEach((row,rowIndex)=>{
    const cells=Array.isArray(row)?row:[];
    for(let col=0;col<cells.length;col+=1){
      const field=canonicalField(cells[col]);
      if(!field || !wanted.has(field)) continue;
      const next=cells[col+1];
      const context=cells.slice(Math.max(0,col-1),Math.min(cells.length,col+4)).join(' ');
      const hit=candidate(field,next,context,{
        extraction_method:'tabular_parser',
        sheet:sheetName || null,
        row:rowIndex+1,
        column:col+2
      });
      if(hit) found.push(hit);
    }
  });
  return found;
}

function extractFromText(text, wanted) {
  const found=[];
  const lines=String(text||'').split(/\r?\n/);
  lines.forEach((line,index)=>{
    const normalizedLine=normalizeLabel(line);
    for(const field of wanted){
      for(const alias of NORMALIZED_ALIASES[field] || []){
        if(!normalizedLine.startsWith(alias+' ') && normalizedLine!==alias) continue;
        const numeric=arabicDigitsToAscii(line).match(/[()]?[+-]?[0-9٠-٩۰-۹][0-9٠-٩۰-۹,\u066B\u066C.\s]*\)?/);
        if(!numeric) continue;
        const hit=candidate(field,numeric[0],line,{
          extraction_method:'text_parser',
          line:index+1
        });
        if(hit) found.push(hit);
      }
    }
  });
  return found;
}

function resolveCandidates(found) {
  const byField=new Map();
  for(const hit of found){
    if(!byField.has(hit.field)) byField.set(hit.field,[]);
    byField.get(hit.field).push(hit);
  }
  const values={}, fields=[], provenance={};
  for(const [field,hits] of byField){
    const unique=[...new Set(hits.map(h=>h.value))];
    const periodGroups={};
    for(const hit of hits){
      const key=hit.period || 'UNSPECIFIED';
      if(!periodGroups[key]) periodGroups[key]=[];
      periodGroups[key].push(hit.value);
    }
    const namedPeriods=Object.keys(periodGroups).filter(key=>key!=='UNSPECIFIED');
    const multiplePeriods=namedPeriods.length>1;
    const conflict=!multiplePeriods && unique.length>1;
    const periodValues=Object.fromEntries(
      Object.entries(periodGroups).map(([period,periodHits])=>[
        period,
        [...new Set(periodHits)].length===1 ? [...new Set(periodHits)][0] : null
      ])
    );
    const status=multiplePeriods ? 'multi_period' : conflict ? 'conflict' : 'extracted';
    if(!conflict && !multiplePeriods) values[field]=unique[0];
    fields.push({
      field,
      value: (conflict || multiplePeriods) ? null : unique[0],
      status,
      candidates: (conflict || multiplePeriods) ? hits.map(h=>({value:h.value,period:h.period||null})) : [],
      period_values: multiplePeriods ? periodValues : {},
      confidence: (conflict || multiplePeriods) ? 0 : Math.max(...hits.map(h=>Number(h.confidence)||0)),
      currency:[...new Set(hits.map(h=>h.currency).filter(Boolean))][0] || null,
      period:multiplePeriods ? null : ([...new Set(hits.map(h=>h.period).filter(Boolean))][0] || null),
      source:hits.map(h=>h.provenance)
    });
    provenance[field]=hits.map(h=>h.provenance);
  }
  return { values, fields, provenance };
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
  const engineCode=engineCodeForAction(primaryAction);
  if(!engineCode) return { supported:false, engine_code:null, required_inputs:[], requirement_fields:[] };
  const result=runFinancialEngine(engineCode,values,{serviceCode});
  return {
    supported:true,
    engine_code:engineCode,
    required_inputs:result.required_inputs || [],
    requirement_fields:requirementFields(result.required_inputs || []),
    engine_result:result
  };
}

function extractFinancialFields({ parsed, primaryAction, serviceCode }) {
  const requirements=requirementsFor({primaryAction,serviceCode,values:{}});
  if(!requirements.supported) return { ...requirements, values:{}, fields:[], provenance:{} };
  const wanted=new Set(requirements.requirement_fields);
  const found=[
    ...extractFromRows(parsed?.rows,parsed?.sheet_name,wanted),
    ...extractFromText(parsed?.text,wanted)
  ];
  const resolved=resolveCandidates(found);
  const validation=validateDataset({
    primaryAction,
    serviceCode,
    values:resolved.values,
    fields:resolved.fields
  });
  const fieldMap=new Map(resolved.fields.map(f=>[f.field,f]));
  const reviewFields=requirements.requirement_fields.map(field => fieldMap.get(field) || {
    field,value:null,status:'missing',candidates:[],currency:null,period:null,source:[]
  });
  return { ...requirements, ...resolved, fields:reviewFields, validation };
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
  const periods=[...new Set(fields.map(f=>f.period).filter(Boolean))];
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

function qualityStatus({ validation={}, fields=[], reviewed=false }={}) {
  const unresolved=Array.isArray(validation.unresolved) ? validation.unresolved : [];
  if(unresolved.some(field=>['conflict','multi_period'].includes(field.status))) return 'conflicting';
  if((validation.missing||[]).length || unresolved.some(field=>field.status==='missing')) return 'partial';
  if(validation.valid!==true) return 'unverified';
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
  return {
    inputs:[...new Set(requirementFields||[])],
    service_code:serviceCode,
    engine_code:engineCode,
    edges:[...new Set(requirementFields||[])].map(field=>({
      from:'input:'+field,
      to:'engine:'+(engineCode||'unknown'),
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
  ALL_FIELDS,
  canonicalField,
  parseNumeric,
  requirementsFor,
  extractFinancialFields,
  validateDataset,
  classifyDocumentType,
  fieldConfidenceMap,
  qualityStatus,
  stableInputHash,
  buildDependencyGraph
};
