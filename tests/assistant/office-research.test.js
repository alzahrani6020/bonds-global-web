jest.mock('../../lib/services/service-execution-router',()=>({executeGovernedAction:jest.fn()}));
const {executeGovernedAction} = require('../../lib/services/service-execution-router');
const {runUniversalOrchestrator} = require('../../lib/assistant/universal-orchestrator');
const {verifyEvidence} = require('../../lib/intelligence/research-intelligence');

const page = {url:'https://ar.wikipedia.org/wiki/عبد_العزيز_بن_سعود_بن_نايف_آل_سعود',title:'عبد العزيز بن سعود بن نايف آل سعود'};
const extract = 'عبد العزيز بن سعود بن نايف بن عبد العزيز آل سعود (ولد في 29 المحرَّم 1404 هـ / 4 نوفمبر 1983 م) [2] وزير الداخلية في المملكة العربية السعودية رئيس لجنة الحج العليا، وقد شغل سابقًا عدة مناصب استشارية';
const summary = () => ({type:'standard',title:page.title,extract,content_urls:{desktop:{page:page.url}}});
// Actual public ministry-summary response observed after the repeated Production gate failed.
const ministryExtract = 'وزارة الداخلية السعودية هي الوزارة المسؤولة عن جميع إمارات المناطق الـ 13 وأحوال المناطق والأمن الداخلي للسعودية وحراسة حدودها مع الدول المجاورة والسلامة وخدمة المواطنين السعوديين، ووزير الداخلية هو الأمير عبد العزيز بن سعود بن نايف منذ 21 يونيو 2017، ويشغل منصب مساعد وزير الداخلية لشؤون العمليات الأستاذ محمد بن مهنا بن عبدالعزيز المهنا، كما يشغل منصب مساعد وزير الداخلية لشؤون التقنية المهندس ثامر بن محمد بن قالط الحربي.';
const ministryPage = {url:'https://ar.wikipedia.org/wiki/وزارة_الداخلية_(السعودية)',title:'وزارة الداخلية (السعودية)',snippet:ministryExtract,status_code:200};
function tools({data=summary(),fetchOk=true,verification=null,rows=[page]}={}) {
  executeGovernedAction.mockImplementation(async ({action,input})=>{
    if(action==='web_search') return {ok:true,result:{results:rows}};
    if(action==='web_fetch') return fetchOk ? {ok:true,result:{text:JSON.stringify(data),content_type:'application/json'}} : {ok:false,error:{code:'UPSTREAM_UNAVAILABLE'}};
    if(action==='evidence_verify') return verification || verifyEvidence(input);
    throw new Error('Unexpected action '+action);
  });
}
const ask = () => runUniversalOrchestrator([{role:'user',content:'من هو وزير الداخلية السعودي؟'}],{},{});
beforeEach(()=>executeGovernedAction.mockReset());
test('reads a live API document and passes its actual role claim through the real verifier',async()=>{
  tools();
  const result = await ask();
  expect(result.reply).toContain('عبد العزيز بن سعود بن نايف بن عبد العزيز آل سعود هو وزير الداخلية في السعودية');
  expect(new URL(result.reply.match(/https:\/\/\S+/u)[0]).href).toBe(new URL(page.url).href);
  expect(result.research.decision_eligible).toBe(true);
  expect(executeGovernedAction.mock.calls.map(([c])=>c.action)).toEqual(['web_search','web_fetch','evidence_verify']);
  expect(executeGovernedAction.mock.calls[0][0].input.query).toBe('وزير الداخلية السعودي');
  expect(executeGovernedAction.mock.calls[1][0].input.url).toContain('https://ar.wikipedia.org/api/rest_v1/page/summary/');
});
test.each([
  ['another country',extract.replace('المملكة العربية السعودية','مصر')],
  ['another office',extract.replace('وزير الداخلية','وزير الخارجية')],
  ['a former holder',extract.replace('وزير الداخلية','وزير الداخلية السابق')]
])('rejects a live document for %s',async(_label,text)=>{
  tools({data:{...summary(),extract:text}});
  const result=await ask();
  expect(result.research.decision_eligible).toBe(false);
  expect(result.reply).toContain('لم أتمكن من توثيق');
  expect(executeGovernedAction.mock.calls.map(([c])=>c.action)).not.toContain('evidence_verify');
});
test('rejects a failed fetch even if the search excerpt claims the expected office',async()=>{
  tools({fetchOk:false,rows:[{...page,snippet:extract}]});
  expect((await ask()).research.decision_eligible).toBe(false);
});
test('reuses a proven live summary-provider document without a redundant fetch',async()=>{
  executeGovernedAction.mockImplementation(async({action,input})=>{
    if(action==='web_search') return {ok:true,evidence:{search_engine:'wikipedia-summary'},result:{results:[{...page,snippet:extract,status_code:200}]}};
    if(action==='evidence_verify') return verifyEvidence(input);
    throw new Error('Unexpected redundant action');
  });
  expect((await ask()).research.decision_eligible).toBe(true);
  expect(executeGovernedAction.mock.calls.map(([c])=>c.action)).toEqual(['web_search','evidence_verify']);
});
test.each([
  ['live provider summary',true],
  ['fetched summary document',false]
])('extracts the current holder from the actual ministry %s',async(_label,provider)=>{
  executeGovernedAction.mockImplementation(async({action,input})=>{
    if(action==='web_search') return {ok:true,evidence:provider?{search_engine:'wikipedia-summary'}:{},result:{results:[ministryPage]}};
    if(action==='web_fetch') return {ok:true,result:{text:JSON.stringify({...summary(),title:ministryPage.title,extract:ministryExtract,content_urls:{desktop:{page:ministryPage.url}}}),content_type:'application/json'}};
    if(action==='evidence_verify') return verifyEvidence(input);
    throw new Error('Unexpected action');
  });
  const result=await ask();
  expect(result.research.decision_eligible).toBe(true);
  expect(result.reply).toContain('عبد العزيز بن سعود بن نايف هو وزير الداخلية في السعودية');
  expect(result.reply).not.toContain('محمد بن مهنا');
});
test.each([
  ['assistant',ministryExtract.replace('ووزير الداخلية هو','ومساعد وزير الداخلية هو')],
  ['deputy',ministryExtract.replace('ووزير الداخلية هو','ونائب وزير الداخلية هو')],
  ['former',ministryExtract.replace('ووزير الداخلية هو','ووزير الداخلية السابق هو')],
  ['other country',ministryExtract.replace(/السعودية|للسعودية/gu,'مصر')],
  ['other portfolio',ministryExtract.replace(/الداخلية/gu,'الخارجية')]
])('rejects ministry wording for an %s',async(_label,text)=>{
  tools({rows:[ministryPage],data:{...summary(),title:ministryPage.title,extract:text,content_urls:{desktop:{page:ministryPage.url}}}});
  expect((await ask()).research.decision_eligible).toBe(false);
});
test('binds the API response to the discovered article',async()=>{
  tools({data:{...summary(),content_urls:{desktop:{page:'https://ar.wikipedia.org/wiki/Another_person'}}}});
  expect((await ask()).research.decision_eligible).toBe(false);
});
test('rejects a contested verifier result',async()=>{
  tools({verification:{ok:false,result:{verification_state:'CONTESTED'}}});
  expect((await ask()).research.decision_eligible).toBe(false);
});
test('bounds document attempts without falling back to a model or crawler',async()=>{
  tools({fetchOk:false,rows:[page,page,page]});
  await ask();
  expect(executeGovernedAction.mock.calls.map(([c])=>c.action)).toEqual(['web_search','web_fetch','web_fetch']);
});
test('office diagnostics omit credentials and source bodies',async()=>{
  const log=jest.spyOn(console,'info').mockImplementation(()=>{});
  try {
    tools();
    await runUniversalOrchestrator([{role:'user',content:'من هو وزير الداخلية السعودي؟'}],{},
      {requestId:'e2e-public-office',req:{headers:{authorization:'Bearer synthetic-private-credential'}}});
    const output=log.mock.calls.map(call=>call.join(' ')).join('\n');
    expect(output).toContain('assistant-office-document');
    expect(output).not.toContain('synthetic-private-credential');
    expect(output).not.toContain(extract);
  } finally {log.mockRestore();}
});
test('resolves the current foreign minister in the observed ministry succession clause',async()=>{
  const text='وزارة الخارجية السعودية، هي الوزارة المسؤولة عن العلاقات الخارجية الدبلوماسية مع الدول الأجنبية بالمملكة العربية السعودية، وهي أول وزارة أنشئت بالمملكة وقد تأسست في 26 رجب 1349هـ الموافق 16 ديسمبر 1930م ، ثم تحولت بالأمر الملكي السامي إلى وزارة، وأول وزير لها الأمير فيصل بن عبد العزيز، ثم تطورت وأصبح وزيرها الأمير فيصل بن فرحان بن عبد الله بن فيصل آل سعود منذ 23 أكتوبر 2019م.';
  const source={url:'https://ar.wikipedia.org/wiki/وزارة_الخارجية_(السعودية)',title:'وزارة الخارجية (السعودية)',snippet:text,status_code:200};
  executeGovernedAction.mockImplementation(async({action,input})=>{
    if(action==='web_search') return {ok:true,evidence:{search_engine:'wikipedia-summary'},result:{results:[source]}};
    if(action==='evidence_verify') return verifyEvidence(input);
    throw new Error('Unexpected action');
  });
  const result=await runUniversalOrchestrator([{role:'user',content:'من وزير الخارجية السعودي'}],{}, {conversationMode:'financial'});
  expect(result.reply).toContain('فيصل بن فرحان بن عبد الله بن فيصل آل سعود هو وزير الخارجية في السعودية');
  expect(result.reply).not.toContain('فيصل بن عبد العزيز');
  expect(result.research.decision_eligible).toBe(true);
  for (const candidate of [
    {...source,title:'وزارة الداخلية (السعودية)'},
    {...source,snippet:text.replace('وأصبح وزيرها','وأصبح مساعد وزيرها')},
    {...source,snippet:text.replace('وأصبح وزيرها','وأصبح وزيرها السابق')}
  ]) {
    executeGovernedAction.mockImplementation(async({action,input})=>{
      if(action==='web_search') return {ok:true,evidence:{search_engine:'wikipedia-summary'},result:{results:[candidate]}};
      if(action==='evidence_verify') return verifyEvidence(input);
      throw new Error('Unexpected action');
    });
    const rejected=await runUniversalOrchestrator([{role:'user',content:'من وزير الخارجية السعودي'}],{}, {conversationMode:'financial'});
    expect(rejected.research.decision_eligible).toBe(false);
  }
});
