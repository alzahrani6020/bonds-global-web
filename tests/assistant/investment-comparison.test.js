'use strict';

const {comparisonContext,runInvestmentComparison}=require('../../lib/assistant/investment-comparison');
const {getRuntimeAdapter}=require('../../lib/capabilities/runtime-adapters');
const setup='للمقارنة لاحقًا: الحالة أ رأس مالها 100000 ريال وصافي ربحها السنوي 20000 ريال. الحالة ب رأس مالها 100000 ريال وصافي ربحها السنوي 30000 ريال. فترة القياس سنة للحالتين.';
const question='قارن بين الحالتين السابقتين من حيث صافي الربح السنوي ونسبة العائد على رأس المال، واحسب الفرق بينهما.';
const user=content=>({role:'user',content});
const calculate=jest.fn(async({action,input})=>{
  if(action!=='math_calculate') throw Error('Unexpected capability');
  return getRuntimeAdapter('assistant_math_calculate')(input);
});
const compare=(source=setup,current=question,extra=[])=>runInvestmentComparison([user(source),...extra,user(current)],{},[],calculate);
beforeEach(()=>calculate.mockClear());

test('retains the observed two-case inputs without generation or claiming a permanent save',async()=>{
  const result=await runInvestmentComparison([user(setup)],{},[],calculate);
  expect(result.planner).toBe('universal-v2-comparison-context');
  expect(result.reply).toContain('100,000');
  expect(result.reply).toContain('20,000');
  expect(result.reply).toContain('30,000');
  expect(result.reply).not.toMatch(/حفظ|saved/iu);
  expect(calculate).not.toHaveBeenCalled();
});
test('completes the actual contextual comparison using the real deterministic math adapter',async()=>{
  const result=await compare();
  expect(result.planner).toBe('universal-v2-deterministic-comparison');
  expect(result.reply).toContain('الحالة أ:');
  expect(result.reply).toContain('الحالة ب:');
  expect(result.reply).toContain('العائد 20%');
  expect(result.reply).toContain('العائد 30%');
  expect(result.reply).toContain('صافي الربح: 10,000 ريال');
  expect(result.reply).toContain('العائد: 10 نقطة مئوية.');
  expect(calculate).toHaveBeenCalledTimes(5);
  expect(result.trace.every(t=>t.execution.ok && t.execution.executed)).toBe(true);
});
test('a brief compare follow-up binds only to the preceding explicit two-case inputs',async()=>{
  expect((await compare(setup,'قارن')).reply).toContain('العائد 30%');
  expect(await compare(setup,'قارن',[user('ما مواصفات الهاتفين الجديدين؟')])).toBeNull();
});
test('an explicit profit update retains the capital and the other case without stale values',async()=>{
  const result=await compare(setup,'الحالة أ صافي ربحها السنوي 25000 ريال، أعد المقارنة بنفس رأس المال.');
  expect(result.reply).toContain('العائد 25%');
  expect(result.reply).toContain('العائد 30%');
  expect(result.reply).toContain('صافي الربح: 5,000 ريال');
  expect(result.reply).toContain('العائد: 5 نقطة مئوية.');
});
test('assistant statements do not replace the user-provided inputs',async()=>{
  const result=await compare(setup,question,[{role:'assistant',content:setup.replace(/20000/gu,'99000')}]);
  expect(result.reply).toContain('العائد 20%');
  expect(result.reply).not.toContain('99%');
});
test('there is no memory shared between separate message lists',async()=>{
  await compare();calculate.mockClear();
  const result=await runInvestmentComparison([user(question)],{},[],calculate);
  expect(result.planner).toBe('universal-v2-comparison-clarification');
  expect(calculate).not.toHaveBeenCalled();
});
test('expired context outside the message window is not silently reused',async()=>{
  const messages=[user(setup),...Array.from({length:10},()=>({role:'assistant',content:'متابعة'})),user(question)];
  expect((await runInvestmentComparison(messages,{},[],calculate)).toolUsed).toBe(false);
  expect(calculate).not.toHaveBeenCalled();
});
test.each([
  ['different currencies',setup.replace('30000 ريال','30000 دولار')],
  ['different periods',setup.replace('ربحها السنوي 30000','ربحها الشهري 30000').replace('فترة القياس سنة للحالتين.','')],
  ['zero capital',setup.replace('رأس مالها 100000','رأس مالها 0')],
  ['missing profit',setup.replace('وصافي ربحها السنوي 30000 ريال.','')],
  ['missing currency',setup.replace(/ريال/gu,'')],
  ['missing period',setup.replace(/السنوي|سنة/gu,'')],
  ['unsafe magnitude',setup.replace('20000','99999999999999999999999')],
  ['conflicting values',setup.replace('20000 ريال.','20000 ريال وصافي ربحها السنوي 25000 ريال.')]
])('requires clarification for %s before performing any calculation',async(_label,source)=>{
  const result=await compare(source);
  expect(result.planner).toBe('universal-v2-comparison-clarification');
  expect(result.toolUsed).toBe(false);
  expect(calculate).not.toHaveBeenCalled();
});
test('an explicit unknown value invalidates the older amount',async()=>{
  const result=await compare(setup,'الحالة أ رأس المال غير معروف، أعد المقارنة.');
  expect(result.toolUsed).toBe(false);
  expect(calculate).not.toHaveBeenCalled();
  const unsupported=await compare(setup,'الحالة أ رأس المال SAR 200000، أعد المقارنة.');
  expect(unsupported.toolUsed).toBe(false);
  expect(calculate).not.toHaveBeenCalled();
});
test('complete corrected inputs replace an earlier conflicting record',async()=>{
  const source=setup.replace('20000 ريال.','20000 ريال وصافي ربحها السنوي 25000 ريال.');
  const result=await compare(source,'الحالة أ رأس مالها 100000 ريال وصافي ربحها السنوي 25000 ريال، أعد المقارنة.');
  expect(result.reply).toContain('العائد 25%');
  expect(result.toolUsed).toBe(true);
});
test('does not leak previous financial cases into a new topic',async()=>{
  expect(await compare(setup,'موضوع جديد: قارن بين الحالتين لهذين الهاتفين')).toBeNull();
  expect(comparisonContext([user(setup),user('موضوع جديد: هذه حالة مختلفة')]).records).toHaveLength(0);
  expect(await compare(setup,'قارن بين الحالتين المرضيتين')).toBeNull();
  expect(await runInvestmentComparison([user('قارن بين الحالتين المرضيتين')],{},[],calculate)).toBeNull();
  expect(await compare(setup,'قارن رأس المال في بنكين عالميين')).toBeNull();
});
test('uses losses and equal values correctly instead of ranking every case positively',async()=>{
  const result=await compare(setup.replace('20000','-20000'));
  expect(result.reply).toContain('العائد -20%');
  expect(result.reply).toContain('صافي الربح: 50,000 ريال');
  expect(result.reply).toContain('العائد: 50 نقطة مئوية.');
});
test('supports Arabic digits, grouped amounts and explicit English inputs',async()=>{
  const source=setup.replace(/100000/gu,'١٠٠٬٠٠٠').replace('20000','٢٠٬٠٠٠').replace('30000','٣٠٬٠٠٠');
  expect((await compare(source)).reply).toContain('العائد 30%');
  const english='For comparison later: Case A capital 100000 SAR annual net profit 20000 SAR. Case B capital 100000 SAR annual net profit 30000 SAR.';
  expect((await compare(english,'Compare the previous cases and their annual profit and return on capital.')).reply).toContain('Return: 10 percentage points.');
});
test('a failed governed calculation never yields a partial or guessed comparison',async()=>{
  const execution=jest.fn(async()=>({ok:false,error:{code:'USER_GOVERNANCE_UNAVAILABLE'}}));
  const result=await runInvestmentComparison([user(setup),user(question)],{},[],execution);
  expect(result.failure).toBe('COMPARISON_CALCULATION_FAILED');
  expect(result.reply).not.toContain('20%');
  expect(result.reply).not.toContain('30%');
});
