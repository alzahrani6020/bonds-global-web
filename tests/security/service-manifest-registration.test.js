/**
 * @jest-environment node
 */

const {
  CAPABILITIES,
  SERVICES,
  GOVERNANCE,
  validateCapabilityInput
} = require(
  '../../lib/capabilities/bonds-capability-registry'
);

const {
  RUNTIME_ADAPTERS
} = require(
  '../../lib/capabilities/runtime-adapters'
);

const {
  MemoryRateLimiter,
  evaluateGovernance
} = require(
  '../../lib/capabilities/governance-gateway'
);


describe(
  'Unified service capability registration',
  () => {

    test(
      'current services are generated',
      () => {
        expect(
          SERVICES['web-research']
        ).toBeDefined();

        expect(
          SERVICES['native-inference']
        ).toBeDefined();

        expect(
          SERVICES['financial-engine']
        ).toBeDefined();

        expect(
          SERVICES['research-intelligence']
        ).toBeDefined();

        expect(
          SERVICES.orchestrator
        ).toBeDefined();

        expect(
          SERVICES['agent-runtime']
        ).toBeDefined();

        expect(
          SERVICES['research-intelligence']
            .security.serviceTokenRequired
        ).toBe(true);

        expect(
          SERVICES.orchestrator
            .security.serviceTokenRequired
        ).toBe(true);

        expect(
          SERVICES['agent-runtime'].enabled
        ).toBe(false);
      }
    );


    test(
      'all existing capabilities remain registered',
      () => {
        expect(
          Object.keys(CAPABILITIES).sort()
        ).toEqual([
          'accounting_adjustment_post',
          'accounting_allocation_execute',
          'accounting_allocation_rule_configure',
          'accounting_asset_create',
          'accounting_bank_reconciliation_run',
          'accounting_budget_analysis',
          'accounting_budget_draft_save',
          'accounting_budget_plan_create',
          'accounting_budget_version_transition',
          'accounting_cash_account_configure',
          'accounting_cash_flow_policy_configure',
          'accounting_changes_in_equity_statement',
          'accounting_collateral_assign',
          'accounting_consolidation_report',
          'accounting_depreciation_policy_configure',
          'accounting_depreciation_post',
          'accounting_dimension_cash_flow_statement',
          'accounting_dimension_create',
          'accounting_dimension_financial_position',
          'accounting_dimension_income_statement',
          'accounting_dimension_ledger_report',
          'accounting_dimension_policy_configure',
          'accounting_equity_movement_policy_configure',
          'accounting_financial_statements_report',
          'accounting_group_configure',
          'accounting_intercompany_link',
          'accounting_journal_post',
          'accounting_period_transition',
          'accounting_trial_balance_report',
          'accounting_year_end_close',
          'accounting_year_end_policy_configure',
          'accounting_year_end_reopen',
          'agent_execute',
          'ai_reason',
          'blind_spot_analyze',
          'bonds_answer_brief',
          'calculator_open',
          'calculator_run',
          'cash_flow_analysis_run',
          'consolidation_run',
          'covenant_monitoring_run',
          'credit_risk_run',
          'creditworthiness_run',
          'debt_schedule_run',
          'decision_graph_build',
          'document_analyze',
          'event_monitor_analyze',
          'evidence_graph_analyze',
          'evidence_verify',
          'feasibility_run',
          'file_security_scan',
          'financial_analysis_run',
          'form_find',
          'form_load',
          'funding_next_requirements',
          'funding_next_step',
          'funding_readiness_run',
          'funding_status',
          'fx_translation_run',
          'language_detect',
          'management_reporting_run',
          'media_classify',
          'native_generate',
          'native_health',
          'orchestrator_run',
          'planning_budgeting_run',
          'profitability_intelligence_run',
          'project_status',
          'recommendation_synthesize',
          'research_intelligence_synthesize',
          'research_intelligence_verify',
          'research_synthesize',
          'risk_analysis_run',
          'scenario_forecast_run',
          'site_navigate',
          'treasury_liquidity_run',
          'unit_economics_run',
          'valuation_run',
          'web_crawl',
          'web_explore',
          'web_fetch',
          'web_search'
        ]);
      }
    );


    test(
      'classifies AI API engine data and workflow actions through one registry',
      () => {
        const {
          getActionDescriptor,
          listActions
        } = require('../../lib/capabilities/bonds-capability-registry');

        expect(getActionDescriptor('native_generate').actionType).toBe('ai');
        expect(getActionDescriptor('ai_reason')).toEqual(expect.objectContaining({
          actionType:'ai',
          serviceCode:'assistant',
          runtimeAdapter:'native_generate'
        }));
        expect(getActionDescriptor('web_fetch').actionType).toBe('api');
        expect(getActionDescriptor('financial_analysis_run').actionType).toBe('engine');
        expect(getActionDescriptor('funding_status').actionType).toBe('data');
        expect(getActionDescriptor('orchestrator_run').actionType).toBe('workflow');
        expect(listActions().length).toBe(Object.keys(CAPABILITIES).length);
      }
    );


    test(
      'all active capabilities have approved adapters',
      () => {
        for (
          const capability of
          Object.values(CAPABILITIES)
        ) {
          if (!capability.active) continue;

          expect(
            typeof RUNTIME_ADAPTERS[
              capability.runtime.adapter
            ]
          ).toBe('function');
        }
      }
    );


    test(
      'unknown capabilities fail closed',
      () => {
        expect(
          validateCapabilityInput(
            'unknown_capability',
            {}
          )
        ).toEqual({
          valid: false,
          code: 'UNKNOWN_CAPABILITY',
          missing: []
        });
      }
    );


    test(
      'required inputs remain enforced',
      () => {
        const result =
          validateCapabilityInput(
            'web_fetch',
            {}
          );

        expect(result.valid).toBe(false);
        expect(result.code)
          .toBe('MISSING_INPUTS');

        expect(result.missing)
          .toContain('url');
      }
    );


    test(
      'governance catalog is generated',
      () => {
        expect(
          GOVERNANCE.permissions
        ).not.toContain(
          'research.web.read'
        );

        expect(
          GOVERNANCE.entitlements
        ).toContain(
          'research.web'
        );

        expect(
          GOVERNANCE.entitlements
        ).toContain(
          'ai.native'
        );

        expect(
          GOVERNANCE.featureFlags
            .map(flag => flag.key)
        ).toEqual(
          expect.arrayContaining([
            'service.web-research.enabled',
            'service.research-intelligence.enabled',
            'service.orchestrator.enabled',
            'service.agent-runtime.enabled'
          ])
        );
      }
    );


    test(
      'sensitive privilege inheritance is denied',
      () => {
        for (
          const service of
          Object.values(SERVICES)
        ) {
          expect(
            service.security
              .requestedSensitivePrivileges
          ).toEqual([]);
        }
      }
    );


    test(
      'AI exposure has one consistent decision',
      () => {
        const service =
          SERVICES['native-inference'];

        expect(
          service.ai.exposed
        ).toBe(false);

        expect(
          service.security
            .privileges
            .ai_tool_exposure
        ).toBe(false);
      }
    );


    test(
      'permissions are enforced by gateway',
      async () => {
        const service = {
          ...SERVICES['web-research'],
          governance: {
            ...SERVICES['web-research'].governance,
            permissions: ['test.permission']
          }
        };

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              actor: { id: 'permission-test' },
              userId: 'permission-test',
              governance: {
                permissions: [],
                entitlements: ['research.web']
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('PERMISSION_DENIED');
      }
    );


    test(
      'entitlements are enforced by gateway',
      async () => {
        const service =
          SERVICES['web-research'];

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              actor: { id: 'entitlement-test' },
              userId: 'entitlement-test',
              governance: {
                permissions: ['research.web.read'],
                entitlements: []
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('ENTITLEMENT_DENIED');
      }
    );


    test(
      'feature flag failure denies capability',
      async () => {
        const service =
          SERVICES['web-research'];

        const capability =
          CAPABILITIES.web_fetch;

        const denied =
          await evaluateGovernance({
            service,
            capability,
            context: {
              governance: {
                isFeatureEnabled:
                  async () => false
              }
            },
            rateLimiter:
              new MemoryRateLimiter()
          });

        expect(denied.allowed)
          .toBe(false);

        expect(denied.code)
          .toBe('FEATURE_DISABLED');
      }
    );


    test(
      'rate limit is enforced',
      async () => {
        const service = {
          ...SERVICES['web-research'],
          limits: {
            ...SERVICES['web-research'].limits,
            requestsPerMinute: 1
          }
        };

        const capability =
          CAPABILITIES.web_fetch;

        const limiter =
          new MemoryRateLimiter();

        const context = {
          actor: {
            id: 'rate-test'
          },
          userId: 'rate-test',
          governance: {
            permissions: ['research.web.read'],
            entitlements: ['research.web']
          }
        };

        const first =
          await evaluateGovernance({
            service,
            capability,
            context,
            rateLimiter: limiter
          });

        const second =
          await evaluateGovernance({
            service,
            capability,
            context,
            rateLimiter: limiter
          });

        expect(first.allowed)
          .toBe(true);

        expect(second.allowed)
          .toBe(false);

        expect(second.code)
          .toBe('RATE_LIMITED');
      }
    );
  }
);
