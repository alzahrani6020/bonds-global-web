/** @jest-environment node */

const {
  buildWorkflowSuggestions,
  completedRequirement
} = require('../../lib/assistant/document-workflow');

describe('assistant document-to-workflow suggestions', () => {
  const requirement = (overrides={}) => ({
    id:'req-1',
    code:'kyc',
    stage_id:'stage-1',
    label_ar:'اعرف عميلك',
    label_en:'KYC',
    is_active:true,
    completion_statuses:['submitted','under_review','approved'],
    ...overrides
  });

  const document = (overrides={}) => ({
    id:'doc-1',
    project_id:'project-1',
    assistant_analysis:{
      classification:{ type:'identity_document', confidence:0.96 },
      policy:{
        values_are_suggestions:true,
        requires_confirmation_before_business_write:true,
        executable_content_allowed:false
      }
    },
    ...overrides
  });

  test('maps identity documents to KYC as suggestion only', () => {
    const out = buildWorkflowSuggestions({
      document:document(),
      requirements:[requirement()],
      submissions:[]
    });

    expect(out.blocked_from_auto_write).toBe(true);
    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0]).toMatchObject({
      requirement_code:'kyc',
      current_status:'not_started',
      policy:{
        suggestion_only:true,
        auto_submit:false,
        requires_user_confirmation:true
      }
    });
  });

  test('does not suggest already completed requirements', () => {
    const req = requirement();
    const out = buildWorkflowSuggestions({
      document:document(),
      requirements:[req],
      submissions:[{ requirement_id:req.id, status:'submitted' }]
    });
    expect(out.suggestions).toEqual([]);
  });

  test('completedRequirement follows the requirement registry statuses', () => {
    const req = requirement();
    expect(completedRequirement(req,{ status:'approved' })).toBe(true);
    expect(completedRequirement(req,{ status:'draft' })).toBe(false);
  });

  test('invoice produces ambiguous receivables/payables suggestions, never auto write', () => {
    const out = buildWorkflowSuggestions({
      document:document({
        assistant_analysis:{
          classification:{ type:'invoice', confidence:0.8 }
        }
      }),
      requirements:[
        requirement({ id:'r1', code:'receivables', label_ar:'الذمم المدينة', label_en:'Receivables' }),
        requirement({ id:'r2', code:'payables', label_ar:'الذمم الدائنة', label_en:'Payables' })
      ],
      submissions:[]
    });

    expect(out.suggestions.map(x=>x.requirement_code).sort()).toEqual(['payables','receivables']);
    expect(out.suggestions.every(x=>x.policy.auto_submit === false)).toBe(true);
  });
});
