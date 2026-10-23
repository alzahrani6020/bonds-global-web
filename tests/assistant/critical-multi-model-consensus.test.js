/** @jest-environment node */

const {
  buildCriticalReviewPrompt,
  aggregateCriticalConsensus,
  reviewCriticalAction
} = require('../../lib/assistant/critical-multi-model-consensus');

function action(risk = 'critical') {
  return {
    id:'critical-001',
    type:'form_submit',
    capability:'form_submit',
    target:'funding_application',
    input:{
      account_number:'SECRET-ACCOUNT-123',
      amount:100000
    },
    risk,
    requires_confirmation:true
  };
}

function response(modelSha, verdict) {
  return {
    ok:true,
    result:{
      text:JSON.stringify({ verdict, reason_codes:['STRUCTURE_OK'] }),
      model_sha256:modelSha
    }
  };
}

function routerFor(reviews) {
  return {
    mode:'REMOTE_BONDS_NATIVE',
    _candidateRemoteProviders:() => reviews.map((item, index) => ({
      id:`native-${index + 1}`,
      provider:{
        generate:jest.fn().mockResolvedValue(response(item.model, item.verdict))
      }
    }))
  };
}

describe('Critical multi-model consensus', () => {
  test('withholds raw action input values from reviewer prompts', () => {
    const prompt = buildCriticalReviewPrompt(action());
    expect(prompt).toContain('account_number');
    expect(prompt).toContain('amount');
    expect(prompt).not.toContain('SECRET-ACCOUNT-123');
    expect(prompt).not.toContain('100000');
  });

  test('does not run multi-model review for non-critical actions', async () => {
    const router = routerFor([
      { model:'model-a', verdict:'approve' },
      { model:'model-b', verdict:'approve' }
    ]);

    const result = await reviewCriticalAction({ action:action('high'), router });

    expect(result.status).toBe('not_applicable');
    expect(result.multi_model).toBe(false);
    expect(router._candidateRemoteProviders).not.toHaveBeenCalled;
  });

  test('returns unavailable when fewer than two reviewer nodes exist', async () => {
    const result = await reviewCriticalAction({
      action:action(),
      router:routerFor([{ model:'model-a', verdict:'approve' }])
    });

    expect(result.status).toBe('not_available');
    expect(result.verdict).toBe('not_available');
    expect(result.multi_model).toBe(false);
    expect(result.execution_authorized).toBe(false);
  });

  test('requires distinct model identities instead of counting duplicate replicas', async () => {
    const result = await reviewCriticalAction({
      action:action(),
      router:routerFor([
        { model:'same-model', verdict:'approve' },
        { model:'same-model', verdict:'approve' }
      ])
    });

    expect(result.status).toBe('not_available');
    expect(result.reason).toBe('DISTINCT_MODEL_REQUIREMENT_NOT_MET');
    expect(result.distinct_model_count).toBe(1);
    expect(result.multi_model).toBe(false);
  });

  test('reports advisory approve consensus from two distinct models', async () => {
    const result = await reviewCriticalAction({
      action:action(),
      router:routerFor([
        { model:'model-a', verdict:'approve' },
        { model:'model-b', verdict:'approve' }
      ])
    });

    expect(result.status).toBe('completed');
    expect(result.verdict).toBe('consensus_approve_for_review');
    expect(result.distinct_model_count).toBe(2);
    expect(result.multi_model).toBe(true);
    expect(result.human_review_required).toBe(true);
    expect(result.execution_authorized).toBe(false);
    expect(result.auto_execute).toBe(false);
  });

  test('reports disagreement rather than manufacturing consensus', () => {
    const result = aggregateCriticalConsensus({
      action:action(),
      reviews:[
        { ok:true, model_sha256:'model-a', verdict:'approve', reason_codes:['OK'] },
        { ok:true, model_sha256:'model-b', verdict:'reject', reason_codes:['RISK'] }
      ]
    });

    expect(result.status).toBe('completed');
    expect(result.verdict).toBe('no_consensus');
    expect(result.multi_model).toBe(true);
    expect(result.execution_authorized).toBe(false);
  });
});
