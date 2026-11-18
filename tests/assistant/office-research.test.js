jest.mock('../../lib/services/service-execution-router',()=>({executeGovernedAction:jest.fn()}));
const {executeGovernedAction} = require('../../lib/services/service-execution-router');
const {runUniversalOrchestrator} = require('../../lib/assistant/universal-orchestrator');
const {verifyEvidence} = require('../../lib/intelligence/research-intelligence');

const page = {url:'https://ar.wikipedia.org/wiki/عبد_العزيز_بن_سعود_بن_نايف_آل_سعود',title:'عبد العزيز بن سعود بن نايف آل سعود'};
const extract = 'عبد العزيز بن سعود بن نايف بن عبد العزيز آل سعود (ولد في 29 المحرَّم 1404 هـ / 4 نوفمبر 1983 م) [2] وزير الداخلية في المملكة العربية السعودية رئيس لجنة الحج العليا، وقد شغل سابقًا عدة مناصب استشارية';
const summary = () => ({type:'standard',title:page.title,extract,content_urls:{desktop:{page:page.url}}});
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
