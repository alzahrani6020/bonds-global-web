'use strict';

// Synthetic, non-persistent acceptance fixtures. Every scenario is evaluated by
// the same financial-analysis engine and accounting gate as actual submissions.
const crypto = require('node:crypto');
const {financialAnalysis} = require('./engines/financial-analysis-engine');
const {deriveFinancialInputs,validateDataset} = require('./financial-data-intake');

const YEARS=Object.freeze([2024,2025,2026]);
const FIXTURES=Object.freeze({
 healthy:Object.freeze({
  label_ar:'شركة رابحة',label_en:'Profitable business',
  revenue:[1400000,1650000,1900000],cogs:[820000,940000,1070000],
  operating_expenses:[300000,340000,380000],
  depreciation_amortization:[80000,90000,100000],
  net_income:[190000,250000,315000],
  total_assets:[900000,1100000,1300000],
  total_liabilities:[460000,520000,570000],
  current_assets:[400000,480000,560000],
  current_liabilities:[190000,210000,220000],
  total_debt:[300000,340000,350000],
  inventory:[110000,115000,125000],
  receivables:[100000,125000,145000],
  payables:[120000,128000,138000],
  interest_expense:[28000,32000,35000],
  cash:[90000,110000,145000],
  opening_cash:[75000,90000,110000],
  operating_cash_flow:[250000,290000,360000],
  investing_cash_flow:[-210000,-260000,-310000],
  financing_cash_flow:[-25000,-10000,-15000],
  cash_available_for_debt_service:[245000,290000,360000],
  scheduled_debt_service:[100000,115000,125000],
  one_off_income:[0,0,0]
 }),
 stressed:Object.freeze({
  label_ar:'شركة متعثرة',label_en:'Distressed business',
  revenue:[1500000,1350000,1150000],cogs:[980000,950000,840000],
  operating_expenses:[480000,470000,450000],
  depreciation_amortization:[70000,70000,70000],
  net_income:[-40000,-170000,-245000],
  total_assets:[980000,930000,850000],
  total_liabilities:[680000,710000,760000],
  current_assets:[420000,365000,310000],
  current_liabilities:[380000,410000,450000],
  total_debt:[500000,540000,590000],
  inventory:[155000,145000,140000],
  receivables:[115000,105000,95000],
  payables:[160000,168000,181000],
  interest_expense:[65000,70000,75000],
  cash:[120000,85000,75000],
  opening_cash:[100000,120000,85000],
  operating_cash_flow:[50000,-100000,-180000],
  investing_cash_flow:[-40000,-20000,-10000],
  financing_cash_flow:[10000,85000,180000],
  cash_available_for_debt_service:[60000,-70000,-150000],
  scheduled_debt_service:[100000,110000,120000],
  one_off_income:[0,0,0]
 })
});
const numeric=value=>typeof value==='number'&&Number.isFinite(value);
const round=value=>numeric(value)?Math.round(value*10000)/10000:null;
const ratio=(a,b)=>numeric(a)&&numeric(b)&&b!==0?round(a/b):null;
const pct=(a,b)=>{const v=ratio(a,b);return v===null?null:round(v*100);};
const reconcile=(code,actual,expected)=>{
 if(!numeric(actual)||!numeric(expected))return {code,status:'UNVERIFIED',difference:null};
 const difference=round(actual-expected);
 const tolerance=Math.max(1,Math.abs(expected)*0.005);
 return {code,status:Math.abs(difference)<=tolerance?'PASS':'FAIL',difference,tolerance};
};
function annualFromFixture(fixture,index,corrupt){
 const values=Object.fromEntries(Object.entries(fixture)
   .filter(([,arr])=>Array.isArray(arr)).map(([key,arr])=>[key,arr[index]]));
 // The actual engine's input contract is preserved; absent numbers are
 // inferred by its governing intake rules, not filled with arbitrary zeros.
 const ebit=values.revenue-values.cogs-values.operating_expenses;
 values.ebitda=ebit+values.depreciation_amortization;
 values.cash_flow_net_income=values.net_income;
 values.ending_cash=values.cash;
 if(index) {
  values.prior_revenue=fixture.revenue[index-1];
  values.prior_net_income=fixture.net_income[index-1];
 }
 if(corrupt && index===2){
  values.total_assets=1250000;
  values.equity=730000;
  values.total_debt=700000;
  values.operating_income=2000000;
  values.ebitda=100000;
  values.ending_cash=110000;
 }
 const derived=deriveFinancialInputs(values);
 const checked=validateDataset({
  primaryAction:'financial_analysis_run',serviceCode:'financial_analysis',
  values:derived.values,fields:derived.fields
 });
 const computed=financialAnalysis(derived.values,{serviceCode:'financial_analysis'});
 const balance=reconcile('BALANCE_SHEET',derived.values.total_assets,
   derived.values.total_liabilities+derived.values.equity);
 const cash=reconcile('CASH_ROLL_FORWARD',derived.values.ending_cash,
   derived.values.opening_cash+derived.values.operating_cash_flow+
   derived.values.investing_cash_flow+derived.values.financing_cash_flow);
 const ebitCheck=reconcile('EBIT_RECONCILIATION',derived.values.operating_income,ebit);
 const netIncome=reconcile('CASH_FLOW_NET_INCOME',derived.values.cash_flow_net_income,derived.values.net_income);
 const ebitdaCheck=reconcile('EBITDA_BRIDGE',derived.values.ebitda,
   derived.values.operating_income+derived.values.depreciation_amortization);
 const cashBalance=reconcile('CASH_TO_BALANCE_SHEET',derived.values.ending_cash,derived.values.cash);
 const controls=[balance,cash,ebitCheck,netIncome,ebitdaCheck,cashBalance];
 const ccc=round(365*(ratio(derived.values.inventory,derived.values.cogs)||
  0)+365*(ratio(derived.values.receivables,derived.values.revenue)||0)-
  365*(ratio(derived.values.payables,derived.values.cogs)||0));
 const cccSupported=[derived.values.inventory,derived.values.cogs,derived.values.receivables,
   derived.values.revenue,derived.values.payables].every(numeric)&&
   derived.values.cogs>0&&derived.values.revenue>0;
 const vertical={
  cogs_pct:pct(derived.values.cogs,derived.values.revenue),
  operating_expenses_pct:pct(derived.values.operating_expenses,derived.values.revenue),
  net_margin_pct:pct(derived.values.net_income,derived.values.revenue)
 };
 const credit={
  cfads:derived.values.cash_available_for_debt_service,
  scheduled_debt_service:derived.values.scheduled_debt_service,
  dscr:ratio(derived.values.cash_available_for_debt_service,derived.values.scheduled_debt_service),
  evidence:'synthetic_cfads_and_debt_service'
 };
 const riskCodes=[];
 if(controls.some(item=>item.status==='FAIL')||!checked.valid)riskCodes.push('ACCOUNTING_MISMATCH');
 if(computed.metrics.current_ratio!==null&&computed.metrics.current_ratio<1)riskCodes.push('LOW_CURRENT_RATIO');
 if(derived.values.operating_cash_flow<0)riskCodes.push('NEGATIVE_OPERATING_CASH_FLOW');
 if(credit.dscr!==null&&credit.dscr<1)riskCodes.push('DEBT_SERVICE_SHORTFALL');
 if(derived.values.net_income<0)riskCodes.push('NET_LOSS');
 return {
  year:YEARS[index],inputs:derived.values,derived:derived.derived,
  audit:controls,validation:{valid:checked.valid,errors:checked.errors,
    warnings:checked.warnings,quality_gate:checked.quality_gate},
  metrics:computed.metrics,vertical,
  cash_flow:{operating:derived.values.operating_cash_flow,
    investing:derived.values.investing_cash_flow,financing:derived.values.financing_cash_flow,
    opening_cash:derived.values.opening_cash,closing_cash:derived.values.ending_cash},
  working_capital:{days_receivable:derived.values.revenue>0?
    round(365*derived.values.receivables/derived.values.revenue):null,
   days_inventory:derived.values.cogs>0?round(365*derived.values.inventory/derived.values.cogs):null,
   days_payable:derived.values.cogs>0?round(365*derived.values.payables/derived.values.cogs):null,
   cash_conversion_cycle_days:cccSupported?ccc:null,
   methodology:'closing_balance_proxy_not_average'},
  quality_of_earnings:{
   cash_to_net_income:derived.values.net_income>0?
    ratio(derived.values.operating_cash_flow,derived.values.net_income):null,
   operating_cash_flow:derived.values.operating_cash_flow,
   non_recurring_income:derived.values.one_off_income,
   caveat:'period_end_only_unverified_sources'
  },
  credit,risk_codes:riskCodes,
  provenance:Object.keys(derived.values).map(key=>({
   field:key,year:YEARS[index],origin:derived.derived.some(f=>f.field===key)?
    'deterministic_formula':'synthetic_fixture',
   formula:derived.derived.find(f=>f.field===key)?.formula||null
  }))
 };
}
function scenarioResult(scenario){
 if(!['healthy','stressed','inconsistent'].includes(scenario)){
  const e=new Error('UNKNOWN_FINANCIAL_LAB_SCENARIO');e.code='UNKNOWN_FINANCIAL_LAB_SCENARIO';throw e;
 }
 const fixture=FIXTURES[scenario==='inconsistent'?'healthy':scenario];
 const periods=YEARS.map((_,i)=>annualFromFixture(fixture,i,scenario==='inconsistent'));
 const latest=periods[2],previous=periods[1];
 const horizontal=periods.slice(1).map((period,i)=>({
  from:periods[i].year,to:period.year,
  revenue_growth_pct:pct(period.inputs.revenue-periods[i].inputs.revenue,Math.abs(periods[i].inputs.revenue)),
  assets_growth_pct:pct(period.inputs.total_assets-periods[i].inputs.total_assets,Math.abs(periods[i].inputs.total_assets)),
  net_income_change:period.inputs.net_income-periods[i].inputs.net_income,
  operating_cash_flow_change:period.inputs.operating_cash_flow-periods[i].inputs.operating_cash_flow
 }));
 const rejected=periods.some(p=>!p.validation.valid||p.audit.some(a=>a.status==='FAIL'));
 const completeness={
  required_periods:3,available_periods:periods.length,
  consistency:rejected?'REJECTED':'PASSED',
  source_reliability:'SYNTHETIC_ONLY',
  independently_verified:false,
  missing_indicators:Object.entries(latest.metrics).filter(([,v])=>!numeric(v)).map(([k])=>k),
  analysis_status:rejected?'REJECTED':Object.values(latest.metrics).every(numeric)?'CALCULATED':'PARTIAL'
 };
 const rev=latest.inputs.revenue,cogs=latest.inputs.cogs,expenses=latest.inputs.operating_expenses;
 const sensitivity={
  methodology:'static_operating_profit_only_no_tax_or_balance_sheet_reforecast',
  baseline_ebit:latest.inputs.operating_income,
  revenue_minus_10_pct:round(rev*.9-cogs-expenses),
  revenue_plus_10_pct:round(rev*1.1-cogs-expenses),
  cogs_plus_10_pct:round(rev-cogs*1.1-expenses),
  cogs_minus_10_pct:round(rev-cogs*.9-expenses)
 };
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({
  scenario,periods:periods.map(p=>p.inputs)
 })).digest('hex');
 return {
  ok:true,mode:'LOCAL_SYNTHETIC_SIMULATION',non_persistent:true,
  saved:false,approved:false,report_approval:'NOT_APPROVED',
  scenario,label_ar:scenario==='inconsistent'?'بيانات متناقضة':fixture.label_ar,
  label_en:scenario==='inconsistent'?'Contradictory accounting data':fixture.label_en,
  currency:'SAR',periods,horizontal,sensitivity,completeness,
  credit_conclusion:rejected?'NOT_ELIGIBLE_FOR_CONCLUSION':
   latest.credit.dscr===null?'INSUFFICIENT_DEBT_SERVICE_DATA':
    latest.credit.dscr<1?'DEBT_SERVICE_STRESS':'DEBT_SERVICE_COVERAGE_SIMULATED',
  benchmarks:{applied:false,reason:'NO_VERIFIED_SECTOR_YEAR_SOURCE'},
  risk_codes:[...new Set(periods.flatMap(p=>p.risk_codes))],
  audit:{fixture_id:'bonds-finance-lab-v1-'+scenario,
   engine:'financial_analysis',fingerprint,source:'synthetic_test_fixture',
   database_writes:0,customer_records_touched:0},
  scenario_change:'none',recommendations:rejected?
   ['RECONCILE_STATEMENTS_BEFORE_ANALYSIS']:latest.risk_codes.length?
   ['INVESTIGATE_WORKING_CAPITAL','REVIEW_DEBT_SERVICE']:
   ['MONITOR_CASH_FLOW','VALIDATE_EXTERNAL_FINANCIAL_STATEMENTS'],
  warning:'TEST DATA ONLY - NOT FOR INVESTMENT OR CREDIT APPROVAL'
 };
}
module.exports={scenarioResult,YEARS};
