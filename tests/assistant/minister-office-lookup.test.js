const { resolveLanguageQuery } = require('../../lib/assistant/language-query-resolver');
const { buildClaimFabric } = require('../../lib/intelligence/claim-fabric');
const { buildSearchRoute } = require('../../lib/intelligence/search-router');
jest.mock('../../lib/services/service-execution-router', () => ({executeGovernedAction:jest.fn()}));
jest.mock('../../lib/intelligence/research-workflow', () => ({runResearchWorkflow:jest.fn()}));
const { runResearchWorkflow } = require('../../lib/intelligence/research-workflow');
const { executeGovernedAction } = require('../../lib/services/service-execution-router');
const { runUniversalOrchestrator } = require('../../lib/assistant/universal-orchestrator');

describe('minister office routing (production failure acf04343)', () => {
  beforeEach(() => { executeGovernedAction.mockReset(); runResearchWorkflow.mockReset(); });
  test.each(['من هو وزير الداخليه','من هو وزير الداخلية؟','who is the minister of interior?'])(
    'clarifies the jurisdiction without searching a person profile: %s', async question => {
      const plan = resolveLanguageQuery(question);
      expect(plan.intent).toBe('relation_lookup');
      expect(plan.entity.needs_jurisdiction).toBe(true);
      expect(plan.entity.person_entity_frame).toBeUndefined();
      const result = await runUniversalOrchestrator([{role:'user',content:question}],{country:'SA'});
      expect(result.planner).toBe('universal-v2-office-clarification');
      expect(result.reply).toMatch(/أي دولة|Which country/);
      expect(executeGovernedAction).not.toHaveBeenCalled();
  });
  test('routes the scoped screenshot question to the ministry rather than Bonds person pages', () => {
    const plan = resolveLanguageQuery('من هو وزير الداخلية السعودي؟');
    expect(plan.entity_frame.entity_type).toBe('relation');
    expect(plan.entity_frame.canonical_name).toBe('وزارة الداخلية السعودية');
    expect(plan.requires_research).toBe(true);
    expect(plan.query_variants.join(' ')).not.toMatch(/سيرة|biography/);
    const route = buildSearchRoute({query:plan.selected_query,intent:plan.intent,entityFrame:plan.entity_frame});
    expect(route.preferred_domains).toContain('moi.gov.sa');
  });
  test('keeps an explicitly different country in the query', () => {
    const plan = resolveLanguageQuery('من هو وزير الداخلية في مصر؟');
    expect(plan.selected_query).toContain('مصر');
    expect(plan.selected_query).not.toContain('السعودية');
  });
  test('extracts an explicit ministry holder and rejects a different portfolio or former holder', () => {
    const entityFrame = resolveLanguageQuery('من هو وزير الداخلية السعودي؟').entity_frame;
    const source = text => ({id:'official',url:'https://www.moi.gov.sa/',publisher:'وزارة الداخلية السعودية',text,authoritative_primary:true,authority_score:1});
    const fabric = text => buildClaimFabric({entityFrame,sources:[source(text)]});
    expect(fabric('التقى الأمير أحمد بن محمد وزير الداخلية، المسؤولين اليوم.').fused_claims)
      .toEqual(expect.arrayContaining([expect.objectContaining({predicate:'relation.holder',value:'أحمد بن محمد',verification_state:'VERIFIED'})]));
    expect(fabric('التقى الأمير أحمد بن محمد وزير الخارجية، المسؤولين اليوم.').fused_claims).toHaveLength(0);
    expect(fabric('الأمير أحمد بن محمد وزير الداخلية السابق، حضر الاجتماع.').fused_claims).toHaveLength(0);
  });
  test('renders the verified holder with its evidence URL and no personal-profile seeds', async () => {
    const question = 'من هو وزير الداخلية السعودي؟';
    const entityFrame = resolveLanguageQuery(question).entity_frame;
    const source = {id:'official',url:'https://www.moi.gov.sa/',title:'وزارة الداخلية السعودية',snippet:'الأمير أحمد بن محمد وزير الداخلية'};
    runResearchWorkflow.mockResolvedValue({decisionEligible:true,entity_frame:entityFrame,
      search:{ok:true,result:{results:[source]}},
      claim_fabric:{sources:[source],fused_claims:[{predicate:'relation.holder',value:'أحمد بن محمد',value_normalized:'احمد بن محمد',verification_state:'VERIFIED',supporting_sources:['official']}]}});
    const result = await runUniversalOrchestrator([{role:'user',content:question}]);
    expect(result.reply).toContain('أحمد بن محمد');
    expect(result.reply).toContain(source.url);
    expect(runResearchWorkflow.mock.calls[0][0].research.firstPartyDiscoveryUrls).toEqual([]);
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });
  test('does not turn unrelated search hits into an answer about the holder', async () => {
    runResearchWorkflow.mockResolvedValue({decisionEligible:false,
      search:{ok:true,result:{results:[{url:'https://example.org',snippet:'unrelated result'}]}},
      claim_fabric:{fused_claims:[]}});
    const result = await runUniversalOrchestrator([{role:'user',content:'من هو وزير الداخلية السعودي؟'}]);
    expect(result.reply).toContain('لم أتمكن من توثيق');
    expect(result.research.status).toBe('insufficient_evidence');
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });
});
