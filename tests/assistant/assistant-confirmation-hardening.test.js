const {
  explicitMutationConfirmation,
  runUniversalOrchestrator
} = require('../../lib/assistant/universal-orchestrator');

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');

const ORCHESTRATOR_OPTIONS = { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} };

function fastSnippetMocks({ verification }) {
  executeGovernedAction.mockImplementation(async ({ action }) => {
    if (action === 'web_search') {
      return {
        ok:true,
        executed:true,
        action,
        result:{
          results:[{
            title:'الموقع الرسمي لوزارة المالية السعودية',
            url:'https://www.mof.gov.sa/home',
            snippet:'تصفح خدمات وزارة المالية والبيانات المفتوحة.'
          }]
        }
      };
    }
    if (action === 'web_fetch') {
      return {
        ok:true,
        executed:true,
        result:{ text:'تصفح خدمات وزارة المالية والبيانات المفتوحة والتقارير المالية.' }
      };
    }
    if (action === 'evidence_verify') {
      if (verification instanceof Error) throw verification;
      return verification;
    }
    throw new Error('UNEXPECTED_ACTION:' + action);
  });
}

describe('assistant confirmation hardening', () => {
  beforeEach(() => {
    executeGovernedAction.mockReset();
  });

  describe('explicitMutationConfirmation binds consent to the pending action', () => {
    test('rejects bare agreement words for any pending mutation', () => {
      expect(explicitMutationConfirmation([{ role:'user', content:'موافق' }], 'accounting_journal_post')).toBe(false);
      expect(explicitMutationConfirmation([{ role:'user', content:'أؤكد ذلك' }], 'accounting_journal_post')).toBe(false);
      expect(explicitMutationConfirmation([{ role:'user', content:'أكد التنفيذ' }], 'accounting_journal_post')).toBe(false);
      expect(explicitMutationConfirmation([{ role:'user', content:'confirm' }], 'accounting_journal_post')).toBe(false);
      expect(explicitMutationConfirmation([{ role:'user', content:'approve please' }], 'accounting_journal_post')).toBe(false);
    });

    test('accepts agreement words only when they name the pending action', () => {
      expect(explicitMutationConfirmation(
        [{ role:'user', content:'موافق على تنفيذ accounting_journal_post' }],
        'accounting_journal_post'
      )).toBe(true);
      expect(explicitMutationConfirmation(
        [{ role:'user', content:'approved for BONDS-CAP-FIN-044' }],
        { action:'accounting_journal_post', id:'BONDS-CAP-FIN-044' }
      )).toBe(true);
      expect(explicitMutationConfirmation(
        [{ role:'user', content:'موافق على report_generate' }],
        'accounting_journal_post'
      )).toBe(false);
    });

    test('keeps execution imperatives and non-confirmation text working', () => {
      // Existing confirmation contract: a bare execution imperative confirms.
      expect(explicitMutationConfirmation([{ role:'user', content:'نفذ الآن' }], 'accounting_journal_post')).toBe(true);
      expect(explicitMutationConfirmation([{ role:'user', content:'نفّذ' }], 'accounting_journal_post')).toBe(true);
      // Execution imperative naming a different identifier must not slip through.
      expect(explicitMutationConfirmation([{ role:'user', content:'نفذ report_generate' }], 'accounting_journal_post')).toBe(false);
      // No confirmation wording at all.
      expect(explicitMutationConfirmation([{ role:'user', content:'جهزه فقط' }], 'accounting_journal_post')).toBe(false);
      // No pending action: any confirmation wording keeps prior behavior.
      expect(explicitMutationConfirmation([{ role:'user', content:'نفذ' }], null)).toBe(true);
      expect(explicitMutationConfirmation([{ role:'user', content:'موافق' }], null)).toBe(true);
    });
  });

  describe('mutation gate requires bound confirmation', () => {
    test('does not execute a pending mutation on a bare موافق', async () => {
      executeGovernedAction.mockResolvedValueOnce({
        ok:true,
        result:{ result:{ text:'{"mode":"tool","action":"accounting_journal_post","input":{"entry_id":"x"}}' } }
      });

      const result = await runUniversalOrchestrator(
        [{ role:'user', content:'جهز القيد المحاسبي، موافق' }],
        {},
        ORCHESTRATOR_OPTIONS
      );

      expect(result.ok).toBe(true);
      expect(result.confirmationRequired).toBe(true);
      expect(result.pendingAction.action).toBe('accounting_journal_post');
      expect(executeGovernedAction).toHaveBeenCalledTimes(1);
      expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'accounting_journal_post')).toBe(false);
    });

    test('executes the pending mutation on an execution imperative', async () => {
      executeGovernedAction.mockImplementation(async ({ action }) => {
        if (action === 'accounting_journal_post') {
          return { ok:true, executed:true, action, result:{ posted:true } };
        }
        const posted = executeGovernedAction.mock.calls
          .some(call => call[0].action === 'accounting_journal_post');
        const text = posted
          ? '{"mode":"answer","answer":"تم ترحيل القيد."}'
          : '{"mode":"tool","action":"accounting_journal_post","input":{"entry_id":"x"}}';
        return { ok:true, result:{ result:{ text } } };
      });

      const result = await runUniversalOrchestrator(
        [{ role:'user', content:'رحّل القيد المحاسبي، نفذ الآن' }],
        {},
        ORCHESTRATOR_OPTIONS
      );

      expect(result.ok).toBe(true);
      expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'accounting_journal_post')).toBe(true);
      expect(result.confirmationRequired).not.toBe(true);
    });
  });

  describe('fast research path does not present verified answers after failed verification', () => {
    test('qualifies the answer and reports the state when evidence_verify is contested', async () => {
      fastSnippetMocks({
        verification:{
          ok:false,
          executed:true,
          result:{ verification_state:'CONTESTED', supported_claims:[], contradictions:[{ claim:'x' }] }
        }
      });

      const result = await runUniversalOrchestrator(
        [{ role:'user', content:'اشرح كيف اعمل ميزانية' }],
        {},
        ORCHESTRATOR_OPTIONS
      );

      expect(result.ok).toBe(true);
      expect(result.research.verification_state).toBe('CONTESTED');
      expect(result.reply).toContain('غير موثقة');
    });

    test('qualifies the answer and reports UNVERIFIED when evidence_verify throws', async () => {
      fastSnippetMocks({ verification:new Error('verify transport down') });

      const result = await runUniversalOrchestrator(
        [{ role:'user', content:'اشرح كيف اعمل ميزانية' }],
        {},
        ORCHESTRATOR_OPTIONS
      );

      expect(result.ok).toBe(true);
      expect(result.research.verification_state).toBe('UNVERIFIED');
      expect(result.reply).toContain('غير موثقة');
    });

    test('keeps the supported answer unqualified when evidence_verify succeeds', async () => {
      fastSnippetMocks({
        verification:{ ok:true, executed:true, result:{ verification_state:'SUPPORTED' } }
      });

      const result = await runUniversalOrchestrator(
        [{ role:'user', content:'اشرح كيف اعمل ميزانية' }],
        {},
        ORCHESTRATOR_OPTIONS
      );

      expect(result.ok).toBe(true);
      expect(result.research.verification_state).toBe('SUPPORTED');
      expect(result.reply).not.toContain('غير موثقة');
      expect(result.reply).toContain('الموقع الرسمي لوزارة المالية السعودية');
    });
  });
});
