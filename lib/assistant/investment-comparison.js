'use strict';

const {executeGovernedAction} = require('../services/service-execution-router');

// Read only this request's user messages. Assistant prose is never promoted
// into financial inputs; there is no shared or cross-user memory here.
function normalize(text) {
  return String(text || '').normalize('NFKC')
    .replace(/[٠-٩]/gu,c=>String(c.charCodeAt(0)-1632))
    .replace(/[۰-۹]/gu,c=>String(c.charCodeAt(0)-1776))
    .replace(/[\u064B-\u065F\u0670\u0640]/gu,'')
    .replace(/[أإآ]/gu,'ا').replace(/ى/gu,'ي');
}

function number(value, magnitude) {
  let raw=normalize(value).replace(/٬/gu,',').replace(/٫/gu,'.');
  if (raw.includes(',')) {
    if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/u.test(raw)) return null;
    raw=raw.replace(/,/gu,'');
  }
  const scale=/^(?:مليار|billion)$/iu.test(magnitude || '') ? 1e9
    : /^(?:مليون|million)$/iu.test(magnitude || '') ? 1e6
      : magnitude ? 1e3 : 1;
  const valueNumber=Number(raw)*scale;
  return Number.isFinite(valueNumber) && Math.abs(valueNumber)<=Number.MAX_SAFE_INTEGER ? valueNumber : null;
}

function field(text, name) {
  const metric=name==='capital'
    ? '(?:راس\\s*(?:مال(?:ها|ه)?|المال)|capital|investment)'
    : '(?:صافي\\s*(?:ال)?ربح(?:ها|ه)?|(?:annual\\s+|monthly\\s+)?(?:net\\s+)?profit)';
  const re=new RegExp(metric+'(?:\\s+(?:السنوي|الشهري|سنويا|شهريا|annual|monthly))?\\s*(?::|=|هو|هي|يبلغ|is)?\\s*([+-]?[0-9][0-9.,٬٫]*)(?:\\s*(الف|مليون|مليار|thousand|million|billion|k)(?=\\s|[،,.]|$))?','giu');
  const matches=[...text.matchAll(re)];
  if (!matches.length) {
    const unresolved=new RegExp(metric+'([^،.]{0,40})','iu').exec(text)?.[1] || '';
    const retained=/^\s*(?:كما\s+هو|نفسه|السابق|unchanged|same)(?:\s|$)/iu.test(unresolved);
    return !retained && (/[0-9]/u.test(unresolved) || /غير\s+(?:معروف|محدد|متاح)|unknown|missing/iu.test(unresolved))
      ? {found:true,invalid:true} : {found:false};
  }
  const values=matches.map(m=>number(m[1],m[2]));
  if (values.some(v=>v===null) || new Set(values).size!==1) return {found:true,invalid:true};
  return {found:true,value:values[0]};
}

function period(text) {
  const month=/(?:الشهري|شهريا|شهر|monthly|month)/iu.test(text);
  const year=/(?:السنوي|سنويا|سنة|سنوي|annual|year)/iu.test(text);
  return month && year ? 'conflict' : month ? 'month' : year ? 'year' : null;
}

function currency(text) {
  const found=[];
  if (/\bSAR\b|ريال\s+سعودي/iu.test(text)) found.push('SAR');
  if (/\bUSD\b|دولار\s+امريكي/iu.test(text)) found.push('USD');
  if (/\bEGP\b|جنيه\s+مصري/iu.test(text)) found.push('EGP');
  const rest=text.replace(/ريال\s+سعودي|دولار\s+امريكي|جنيه\s+مصري/giu,'');
  if (/ريال/iu.test(rest)) found.push('ريال');
  if (/دولار/iu.test(rest)) found.push('دولار');
  if (/جنيه/iu.test(rest)) found.push('جنيه');
  return new Set(found).size>1 ? 'conflict' : found[0] || null;
}

function comparisonContext(messages) {
  const records=new Map();
  for (const message of (Array.isArray(messages) ? messages : []).slice(-10)) {
    if (message?.role!=='user') continue;
    const original=String(message.content || '').slice(0,12000);
    const text=normalize(original);
    if (/^(?:موضوع\s+جديد|تجاهل\s+(?:ما\s+سبق|السابق)|new\s+topic|start\s+over)(?:\s|[:،.]|$)/iu.test(text)) {
      records.clear();
    }
    const labels=[...text.matchAll(/(?:الحالة|الحاله|المشروع|الخيار|البديل|case|option|project)\s+([\p{L}\p{N}]+)(?=\s|[:،,.]|$)/giu)];
    const originalLabels=[...original.matchAll(/(?:الحالة|الحاله|المشروع|الخيار|البديل|case|option|project)\s+([\p{L}\p{N}]+)(?=\s|[:،,.]|$)/giu)];
    const sharedPeriod=period(text);
    const sharedCurrency=currency(text);
    for (let i=0;i<labels.length;i++) {
      const segment=text.slice(labels[i].index,labels[i+1]?.index ?? text.length);
      const capital=field(segment,'capital');
      const profit=field(segment,'profit');
      if (!capital.found && !profit.found) continue;
      const label=(originalLabels[i]?.[1] || labels[i][1]).slice(0,40);
      const key=normalize(label).toLocaleLowerCase('ar');
      const previous=records.get(key) || {label};
      const localCurrency=currency(segment) || (sharedCurrency!=='conflict' ? sharedCurrency : null);
      const localPeriod=period(segment) || (sharedPeriod!=='conflict' ? sharedPeriod : null);
      const invalid=Boolean(capital.invalid || profit.invalid || localCurrency==='conflict' || localPeriod==='conflict' ||
        (previous.invalid && !(capital.found && profit.found)) ||
        (previous.currency && localCurrency && previous.currency!==localCurrency && !(capital.found && profit.found)));
      records.set(key,{...previous,
        invalid,
        ...(capital.found ? {capital:capital.value} : {}),
        ...(profit.found ? {profit:profit.value} : {}),
        currency:localCurrency || previous.currency || null,
        period:profit.found ? localPeriod || previous.period || null : previous.period || null
      });
    }
  }
  return {records:[...records.values()],invalid:records.size>4 || [...records.values()].some(r=>r.invalid)};
}

function numeric(value) {
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(value);
}

async function runInvestmentComparison(messages, options={}, trace=[], execute=executeGovernedAction) {
  const current=[...(Array.isArray(messages) ? messages : [])].reverse().find(m=>m?.role==='user')?.content || '';
  const text=normalize(current);
  const later=/^(?:للمقارنة\s+لاحقا|for\s+comparison\s+later)(?:\s|[:،.]|$)/iu.test(text);
  const comparing=/قارن|مقارن[ةه]|\bcompar(?:e|ison)\b/iu.test(text);
  if (!later && !comparing) return null;
  const reference=/(?:الحالتين|الحالات|المشروعين|البديلين|الخيارين|السابق(?:تين|ين)|(?:الحالة|المشروع|case)\s+[\p{L}\p{N}]+|cases|previous\s+(?:two|cases))/iu.test(text);
  const financial=/(?:راس\s*(?:مال|المال)|صافي\s*(?:ال)?ربح|نسبة\s*العائد|capital|profit|\broi\b)/iu.test(text);
  const previousUser=[...(Array.isArray(messages) ? messages : [])].reverse().filter(m=>m?.role==='user')[1]?.content || '';
  const previousRows=comparisonContext([{role:'user',content:previousUser}]).records.length;
  const bare=/^(?:قارن(?:هما|ها)?(?:\s+الان)?|مقارنة|compare(?:\s+them)?)[؟?!.]*$/iu.test(text.trim()) && previousRows===2;
  const referenceOnly=/^(?:قارن(?:\s+بين)?\s+(?:الحالتين|المشروعين|البديلين|الخيارين)(?:\s+السابق(?:تين|ين))?|compare\s+(?:the\s+)?(?:previous\s+)?(?:two\s+)?(?:cases|options|projects))[؟?!.]*$/iu.test(text.trim());
  if (!later && !reference && !bare) return null;
  if (later && !financial) return null;
  if (!later && !financial && !bare && !referenceOnly) return null;
  if (!financial && !later && !previousRows && !/(?:راس\s*(?:مال|المال)|صافي\s*(?:ال)?ربح|capital|profit)/iu.test(normalize(previousUser))) return null;
  // Explicit non-financial topics cannot inherit financial rows from earlier turns.
  if (!financial && /هاتف|سيار|وزير|بلد|دولتين|phone|car|minister|countries/iu.test(text)) return null;
  const state=comparisonContext(messages);
  if (!state.records.length && !financial) return null;
  const ar=/[\u0600-\u06ff]/u.test(current);
  const clarification=(reasonAr,reasonEn)=>({ok:true,toolUsed:false,trace,steps:trace.length,
    planner:'universal-v2-comparison-clarification',
    reply:ar ? reasonAr : reasonEn});
  if (state.records.length!==2) return clarification('حدد الحالتين المقصودتين وبيانات رأس المال وصافي الربح لهما.','Identify the two cases and their capital and net-profit inputs.');
  if (state.invalid) return clarification('وردت قيم متعارضة أو غير صالحة في بيانات المقارنة؛ وضّح القيم الصحيحة قبل الحساب.','The comparison contains conflicting or invalid inputs; clarify those values before calculation.');
  const missing=[];
  for (const record of state.records) {
    if (!Number.isFinite(record.capital) || record.capital<=0) missing.push(ar ? 'رأس مال موجب للحالة '+record.label : 'positive capital for case '+record.label);
    if (!Number.isFinite(record.profit)) missing.push(ar ? 'صافي ربح الحالة '+record.label : 'net profit for case '+record.label);
    if (!record.currency) missing.push(ar ? 'عملة الحالة '+record.label : 'currency for case '+record.label);
    if (!record.period) missing.push(ar ? 'فترة الربح للحالة '+record.label : 'profit period for case '+record.label);
  }
  if (missing.length) return clarification('يلزم توضيح: '+missing.join('، ')+'.','Please clarify: '+missing.join(', ')+'.');
  const [a,b]=state.records;
  if (a.currency!==b.currency) return clarification('عملة الحالتين مختلفة؛ حدّد أرقامهما بعملة موحّدة لإجراء المقارنة.','The cases use different currencies; provide their figures in one currency for comparison.');
  if (a.period!==b.period || (period(text) && period(text)!==a.period)) return clarification('فترة الربح مختلفة بين المدخلات أو عن الفترة المطلوبة؛ حدّد فترة موحّدة للمقارنة.','The profit periods differ between the inputs or the requested period; specify one consistent comparison period.');
  const currencyName=a.currency;
  const periodName=ar ? (a.period==='year' ? 'سنة' : 'شهر') : a.period;
  if (later) return {ok:true,toolUsed:false,trace,steps:trace.length,
    planner:'universal-v2-comparison-context',
    reply:ar ? `بيانات الحالتين موجودة في سياق هذه المحادثة (${currencyName}، ${periodName}):\n${a.label}: رأس المال ${numeric(a.capital)}، صافي الربح ${numeric(a.profit)}.\n${b.label}: رأس المال ${numeric(b.capital)}، صافي الربح ${numeric(b.profit)}.`
      : `The two cases are available in this conversation (${currencyName}, ${periodName}):\n${a.label}: capital ${numeric(a.capital)}, net profit ${numeric(a.profit)}.\n${b.label}: capital ${numeric(b.capital)}, net profit ${numeric(b.profit)}.`};
  const expressions=[`(${a.profit}) / (${a.capital}) * 100`,`(${b.profit}) / (${b.capital}) * 100`,
    `(${b.capital}) - (${a.capital})`,`(${b.profit}) - (${a.profit})`,
    `((${b.profit}) / (${b.capital}) - (${a.profit}) / (${a.capital})) * 100`];
  const executions=await Promise.all(expressions.map(async expression=>{
    try {return await execute({action:'math_calculate',input:{expression},req:options.req,user:options.user,
      supabase:options.supabase,requestId:options.requestId,runtimeContext:{timeoutMs:5000}});}
    catch (_) {return {ok:false,error:{code:'COMPARISON_CALCULATION_FAILED'}};}
  }));
  executions.forEach((execution,index)=>trace.push({step:trace.length+1,action:'math_calculate',input:{expression:expressions[index]},execution}));
  if (executions.some(e=>!e?.ok || !e?.executed || typeof e.result?.value!=='number' || !Number.isFinite(e.result.value))) {
    return {ok:true,reply:ar ? 'تعذر إكمال الحساب الموثق للمقارنة؛ لم أعتمد نتائج ناقصة.' : 'The verified comparison calculation did not complete; incomplete results were not accepted.',
      toolUsed:true,trace,steps:trace.length,planner:'universal-v2-deterministic-comparison',failure:'COMPARISON_CALCULATION_FAILED',degraded:true};
  }
  const [ra,rb,dc,dp,dr]=executions.map(e=>e.result.value);
  const reply=ar
    ? `حسب الأرقام التي قدمتها (${currencyName}، فترة الربح: ${periodName}):\nالحالة ${a.label}: رأس المال ${numeric(a.capital)}؛ صافي الربح ${numeric(a.profit)}؛ العائد ${numeric(ra)}%.\nالحالة ${b.label}: رأس المال ${numeric(b.capital)}؛ صافي الربح ${numeric(b.profit)}؛ العائد ${numeric(rb)}%.\nالفروق (${b.label} − ${a.label}):\nرأس المال: ${numeric(dc)} ${currencyName}.\nصافي الربح: ${numeric(dp)} ${currencyName}.\nالعائد: ${numeric(dr)} نقطة مئوية.`
    : `Based on your inputs (${currencyName}, profit period: ${periodName}):\nCase ${a.label}: capital ${numeric(a.capital)}; net profit ${numeric(a.profit)}; return ${numeric(ra)}%.\nCase ${b.label}: capital ${numeric(b.capital)}; net profit ${numeric(b.profit)}; return ${numeric(rb)}%.\nDifferences (${b.label} − ${a.label}):\nCapital: ${numeric(dc)} ${currencyName}.\nNet profit: ${numeric(dp)} ${currencyName}.\nReturn: ${numeric(dr)} percentage points.`;
  return {ok:true,reply,toolUsed:true,trace,steps:trace.length,planner:'universal-v2-deterministic-comparison'};
}

module.exports={comparisonContext,runInvestmentComparison};
