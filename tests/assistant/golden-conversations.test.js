/** @jest-environment node */

const {
  GOLDEN_CONVERSATIONS_VERSION,
  corpus,
  validateGoldenConversationCorpus,
  evaluateGoldenConversation,
  runGoldenConversations
} = require('../../lib/assistant/golden-conversations');

describe('Assistant Golden Conversations', () => {
  test('v1 corpus is versioned, bilingual and contains denial coverage', () => {
    const result=validateGoldenConversationCorpus(corpus);
    expect(GOLDEN_CONVERSATIONS_VERSION).toBe(1);
    expect(result).toEqual(expect.objectContaining({
      valid:true,
      conversation_count:8,
      languages:['ar','en']
    }));
    expect(result.denied_count).toBeGreaterThan(0);
  });

  test('all golden conversations match current deterministic Assistant planner invariants', () => {
    const result=runGoldenConversations();
    expect(result).toMatchObject({
      version:1,
      status:'pass',
      conversation_count:8,
      passed:8,
      failed:0,
      execution_authorized:false
    });
    expect(result.results.every(item=>item.pass)).toBe(true);
  });

  test('golden corpus covers safe ready flows and fail-closed flows', () => {
    const ids=new Set(corpus.conversations.map(item=>item.id));
    expect(ids.has('ar_navigation_kyc')).toBe(true);
    expect(ids.has('en_navigation_kyc')).toBe(true);
    expect(ids.has('ar_save_kyc_draft')).toBe(true);
    expect(ids.has('en_unknown_form_denied')).toBe(true);
    expect(ids.has('ar_arbitrary_url_denied')).toBe(true);
    expect(ids.has('en_unimplemented_sensitive_action_denied')).toBe(true);

    for(const item of corpus.conversations){
      expect(item.expected.execution_authorized).not.toBe(true);
      expect(item.expected.auto_execute).not.toBe(true);
    }
  });

  test('detects planner drift instead of normalizing it away', () => {
    const source=corpus.conversations.find(item=>item.id==='ar_navigation_kyc');
    const changed={
      ...source,
      expected:{
        ...source.expected,
        action:{...source.expected.action,target:'cash_flow'}
      }
    };
    const result=evaluateGoldenConversation(changed);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain('ACTION_TARGET_DRIFT');
  });

  test('rejects forbidden corpus authority and uncontrolled planner keys', () => {
    const changed=JSON.parse(JSON.stringify(corpus));
    changed.conversations[0].expected.execution_authorized=true;
    changed.conversations[0].planner_input.provider='external-model';

    const result=validateGoldenConversationCorpus(changed);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'CONVERSATION_1_PLANNER_KEY_FORBIDDEN:provider',
      'CONVERSATION_1_AUTHORIZATION_FORBIDDEN'
    ]));
  });
});
