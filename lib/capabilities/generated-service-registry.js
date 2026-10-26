'use strict';

module.exports = Object.freeze({
  "services": {
    "agent-runtime": {
      "schemaVersion": 1,
      "serviceCode": "agent-runtime",
      "version": 1,
      "enabled": false,
      "governance": {
        "permissions": [
          "agent.runtime.execute"
        ],
        "entitlements": [
          "agent.runtime"
        ],
        "featureFlags": [
          {
            "key": "service.agent-runtime.enabled",
            "defaultEnabled": false
          }
        ]
      },
      "security": {
        "networkAccess": "runtime_configured",
        "serviceTokenRequired": true,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": [
          "agent.runtime.completed"
        ]
      },
      "ai": {
        "exposed": false
      }
    },
    "assistant": {
      "schemaVersion": 1,
      "serviceCode": "assistant",
      "version": 5,
      "enabled": true,
      "governance": {
        "permissions": [],
        "entitlements": [],
        "featureFlags": []
      },
      "security": {
        "networkAccess": "runtime_configured",
        "serviceTokenRequired": false,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": [
          "assistant.calculate.completed",
          "assistant.read.completed"
        ]
      },
      "ai": {
        "exposed": false
      }
    },
    "financial-engine": {
      "schemaVersion": 1,
      "serviceCode": "financial-engine",
      "version": 16,
      "enabled": true,
      "governance": {
        "permissions": [],
        "entitlements": [],
        "featureFlags": []
      },
      "security": {
        "networkAccess": "none",
        "serviceTokenRequired": false,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": []
      },
      "ai": {
        "exposed": false
      }
    },
    "native-inference": {
      "schemaVersion": 1,
      "serviceCode": "native-inference",
      "version": 1,
      "enabled": true,
      "governance": {
        "permissions": [
          "ai.native.use"
        ],
        "entitlements": [
          "ai.native"
        ],
        "featureFlags": [
          {
            "key": "service.native-inference.enabled",
            "defaultEnabled": true
          }
        ]
      },
      "security": {
        "networkAccess": "runtime_configured",
        "serviceTokenRequired": false,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": false,
        "quality": false
      },
      "workflows": {
        "events": [
          "native-inference.health"
        ]
      },
      "ai": {
        "exposed": false
      }
    },
    "orchestrator": {
      "schemaVersion": 1,
      "serviceCode": "orchestrator",
      "version": 1,
      "enabled": true,
      "governance": {
        "permissions": [
          "orchestrator.execute"
        ],
        "entitlements": [
          "orchestrator"
        ],
        "featureFlags": [
          {
            "key": "service.orchestrator.enabled",
            "defaultEnabled": true
          }
        ]
      },
      "security": {
        "networkAccess": "runtime_configured",
        "serviceTokenRequired": true,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": [
          "orchestrator.completed"
        ]
      },
      "ai": {
        "exposed": false
      }
    },
    "research-intelligence": {
      "schemaVersion": 1,
      "serviceCode": "research-intelligence",
      "version": 2,
      "enabled": true,
      "governance": {
        "permissions": [
          "research.intelligence.execute"
        ],
        "entitlements": [
          "research.intelligence"
        ],
        "featureFlags": [
          {
            "key": "service.research-intelligence.enabled",
            "defaultEnabled": true
          }
        ]
      },
      "security": {
        "networkAccess": "none",
        "serviceTokenRequired": true,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": [
          "research.intelligence.completed"
        ]
      },
      "ai": {
        "exposed": false
      }
    },
    "web-research": {
      "schemaVersion": 1,
      "serviceCode": "web-research",
      "version": 2,
      "enabled": true,
      "governance": {
        "permissions": [],
        "entitlements": [
          "research.web"
        ],
        "featureFlags": [
          {
            "key": "service.web-research.enabled",
            "defaultEnabled": true
          }
        ]
      },
      "security": {
        "networkAccess": "public_only",
        "serviceTokenRequired": false,
        "privileges": {
          "service_role": false,
          "private_network": false,
          "arbitrary_code": false,
          "external_write": false,
          "ai_tool_exposure": false
        },
        "requestedSensitivePrivileges": []
      },
      "limits": {
        "requestsPerMinute": null,
        "retryMaxAttempts": null
      },
      "observability": {
        "healthCheck": true,
        "audit": true,
        "metrics": true
      },
      "data": {
        "provenance": true,
        "quality": true
      },
      "workflows": {
        "events": [
          "research.completed"
        ]
      },
      "ai": {
        "exposed": false
      }
    }
  },
  "capabilities": {
    "agent_execute": {
      "action": "agent_execute",
      "id": "BONDS-CAP-AGENT-001",
      "purpose": "Reserved governed execution boundary for the Bonds agent runtime.",
      "sideEffect": "compute",
      "actionType": "workflow",
      "required": [
        "task"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "agent_execute"
      },
      "serviceCode": "agent-runtime",
      "active": false
    },
    "site_navigate": {
      "action": "site_navigate",
      "id": "BONDS-CAP-ASST-001",
      "purpose": "Resolve a registered BONDS navigation target without accepting arbitrary model-generated URLs.",
      "sideEffect": "none",
      "actionType": "workflow",
      "required": [
        "target"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_site_navigate"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "form_find": {
      "action": "form_find",
      "id": "BONDS-CAP-ASST-002",
      "purpose": "Find a registered BONDS form by logical form code.",
      "sideEffect": "none",
      "actionType": "workflow",
      "required": [
        "form"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_form_find"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "form_load": {
      "action": "form_load",
      "id": "BONDS-CAP-ASST-003",
      "purpose": "Load registered form metadata and its governed navigation target.",
      "sideEffect": "none",
      "actionType": "workflow",
      "required": [
        "form"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_form_load"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "funding_status": {
      "action": "funding_status",
      "id": "BONDS-CAP-ASST-004",
      "purpose": "Read the signed-in user's funding case and completion state.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "case_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_funding_status"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "funding_next_step": {
      "action": "funding_next_step",
      "id": "BONDS-CAP-ASST-005",
      "purpose": "Resolve the next required step for the signed-in user's funding case.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "case_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_funding_next_step"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "funding_next_requirements": {
      "action": "funding_next_requirements",
      "id": "BONDS-CAP-ASST-006",
      "purpose": "List completed and missing requirements for the signed-in user's funding case.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "case_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_funding_next_requirements"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "project_status": {
      "action": "project_status",
      "id": "BONDS-CAP-ASST-007",
      "purpose": "Read a project owned by the signed-in user.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "project_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_project_status"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "calculator_open": {
      "action": "calculator_open",
      "id": "BONDS-CAP-ASST-008",
      "purpose": "Resolve a registered BONDS calculator destination without accepting arbitrary URLs.",
      "sideEffect": "none",
      "actionType": "workflow",
      "required": [
        "calculator"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_calculator_open"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "calculator_run": {
      "action": "calculator_run",
      "id": "BONDS-CAP-ASST-009",
      "purpose": "Execute a registered deterministic BONDS UCP calculation profile; template selection is registry-controlled.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "calculator",
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_calculator_run"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "ai_reason": {
      "action": "ai_reason",
      "id": "BONDS-CAP-ASST-010",
      "purpose": "Reason over bounded BONDS chat context through the configured native inference runtime.",
      "sideEffect": "compute",
      "actionType": "ai",
      "required": [
        "prompt"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "native_generate"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "media_classify": {
      "action": "media_classify",
      "id": "BONDS-CAP-ASST-011",
      "purpose": "Validate and classify file metadata against the central BONDS media intake policy before upload or processing.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "name",
        "size",
        "type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_media_classify"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "language_detect": {
      "action": "language_detect",
      "id": "BONDS-CAP-ASST-012",
      "purpose": "Detect Arabic, English or mixed-script text deterministically without translating or mutating the source.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "text"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_language_detect"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "document_analyze": {
      "action": "document_analyze",
      "id": "BONDS-CAP-ASST-013",
      "purpose": "Analyze one document owned by the signed-in user, persist bounded extracted data, and return assistant-safe evidence without automatic business writes.",
      "sideEffect": "database_write",
      "actionType": "engine",
      "required": [
        "document_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_document_analyze"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "file_security_scan": {
      "action": "file_security_scan",
      "id": "BONDS-CAP-ASST-014",
      "purpose": "Fail-closed malware and structural security scan for an owned quarantined document before parsing, OCR, Vision, download, or assistant use.",
      "sideEffect": "database_write",
      "actionType": "engine",
      "required": [
        "document_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "assistant_file_security_scan"
      },
      "serviceCode": "assistant",
      "active": true
    },
    "financial_analysis_run": {
      "action": "financial_analysis_run",
      "id": "BONDS-CAP-FIN-001",
      "purpose": "Run deterministic financial statement and ratio analysis.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "financial_analysis_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "cash_flow_analysis_run": {
      "action": "cash_flow_analysis_run",
      "id": "BONDS-CAP-FIN-002",
      "purpose": "Run deterministic cash-flow projection and liquidity analysis.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "cash_flow_analysis_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "funding_readiness_run": {
      "action": "funding_readiness_run",
      "id": "BONDS-CAP-FIN-003",
      "purpose": "Assess deterministic funding readiness and debt service capacity.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "funding_readiness_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "creditworthiness_run": {
      "action": "creditworthiness_run",
      "id": "BONDS-CAP-FIN-004",
      "purpose": "Run deterministic creditworthiness scoring and risk banding.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "creditworthiness_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "feasibility_run": {
      "action": "feasibility_run",
      "id": "BONDS-CAP-FIN-005",
      "purpose": "Run deterministic feasibility metrics including NPV, IRR and payback.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "feasibility_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "valuation_run": {
      "action": "valuation_run",
      "id": "BONDS-CAP-FIN-006",
      "purpose": "Run deterministic DCF valuation and equity value computation.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "valuation_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "risk_analysis_run": {
      "action": "risk_analysis_run",
      "id": "BONDS-CAP-FIN-007",
      "purpose": "Run deterministic financial risk scoring across liquidity, leverage and debt service.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "risk_analysis_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "scenario_forecast_run": {
      "action": "scenario_forecast_run",
      "id": "BONDS-CAP-FIN-008",
      "purpose": "Run deterministic forecasting and Monte Carlo scenario analysis.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "scenario_forecast_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_create": {
      "action": "accounting_dimension_create",
      "id": "BONDS-CAP-FIN-009",
      "purpose": "Create a governed accounting cost center or segment for an accounting entity the signed-in user can manage.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "code",
        "dimension_type",
        "name"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_create"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_policy_configure": {
      "action": "accounting_dimension_policy_configure",
      "id": "BONDS-CAP-FIN-015",
      "purpose": "Configure whether a canonical cost-center or segment is mandatory for journal lines posted to a specific account within the same accounting entity.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "account_id",
        "accounting_entity_id",
        "dimension_type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_policy_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_allocation_rule_configure": {
      "action": "accounting_allocation_rule_configure",
      "id": "BONDS-CAP-FIN-016",
      "purpose": "Configure a deterministic fixed-percentage cost-allocation rule across governed expense accounts and canonical dimensions.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "name",
        "rule_code",
        "source_account_id",
        "targets"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_allocation_rule_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_allocation_execute": {
      "action": "accounting_allocation_execute",
      "id": "BONDS-CAP-FIN-017",
      "purpose": "Execute an active governed cost-allocation rule through the canonical atomic accounting posting RPC.",
      "sideEffect": "database_write",
      "actionType": "workflow",
      "required": [
        "accounting_entity_id",
        "amount",
        "effective_at",
        "request_key",
        "rule_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_allocation_execute"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_year_end_policy_configure": {
      "action": "accounting_year_end_policy_configure",
      "id": "BONDS-CAP-FIN-022",
      "purpose": "Configure the retained earnings account and explicit fiscal year-end date for a governed Accounting Entity.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "fiscal_year_end_day",
        "fiscal_year_end_month",
        "retained_earnings_account_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_year_end_policy_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_year_end_close": {
      "action": "accounting_year_end_close",
      "id": "BONDS-CAP-FIN-023",
      "purpose": "Close a complete fiscal year by posting temporary-account closing entries to retained earnings and closing the final accounting period.",
      "sideEffect": "database_write",
      "actionType": "workflow",
      "required": [
        "accounting_entity_id",
        "closing_period_id",
        "fiscal_year_end",
        "fiscal_year_start",
        "request_key"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_year_end_close"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_year_end_reopen": {
      "action": "accounting_year_end_reopen",
      "id": "BONDS-CAP-FIN-024",
      "purpose": "Reopen a previously closed fiscal year by reopening the final period and atomically reversing its year-end closing journal.",
      "sideEffect": "database_write",
      "actionType": "workflow",
      "required": [
        "accounting_entity_id",
        "close_run_id",
        "reason",
        "request_key"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_year_end_reopen"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_income_statement": {
      "action": "accounting_dimension_income_statement",
      "id": "BONDS-CAP-FIN-028",
      "purpose": "Prepare a deterministic income statement by canonical cost-center or segment dimension from posted accounting journals.",
      "sideEffect": "none",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "dimension_type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_income_statement"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_financial_position": {
      "action": "accounting_dimension_financial_position",
      "id": "BONDS-CAP-FIN-030",
      "purpose": "Prepare a deterministic statement of financial position by canonical cost-center or segment dimension from posted accounting journals, including current-period earnings.",
      "sideEffect": "none",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "dimension_type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_financial_position"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_ledger_report": {
      "action": "accounting_dimension_ledger_report",
      "id": "BONDS-CAP-FIN-025",
      "purpose": "Read posted general-ledger balances grouped by canonical cost-center or segment dimensions for an Accounting Entity the signed-in user can access.",
      "sideEffect": "none",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "dimension_type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_ledger_report"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_period_transition": {
      "action": "accounting_period_transition",
      "id": "BONDS-CAP-FIN-010",
      "purpose": "Soft-close, close, or reopen an accounting period through the governed period transition workflow.",
      "sideEffect": "database_write",
      "actionType": "workflow",
      "required": [
        "accounting_entity_id",
        "period_id",
        "transition"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_period_transition"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_asset_create": {
      "action": "accounting_asset_create",
      "id": "BONDS-CAP-FIN-011",
      "purpose": "Create an accounting-linked asset in the canonical bonds_assets registry.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "asset_class",
        "asset_number"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_asset_create"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_collateral_assign": {
      "action": "accounting_collateral_assign",
      "id": "BONDS-CAP-FIN-012",
      "purpose": "Assign a canonical asset as collateral within the same accounting entity.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "asset_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_collateral_assign"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_depreciation_policy_configure": {
      "action": "accounting_depreciation_policy_configure",
      "id": "BONDS-CAP-FIN-013",
      "purpose": "Configure deterministic straight-line fixed-asset depreciation policy using explicit ledger accounts.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "accumulated_depreciation_account_id",
        "asset_id",
        "depreciation_expense_account_id",
        "in_service_date"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_depreciation_policy_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_depreciation_post": {
      "action": "accounting_depreciation_post",
      "id": "BONDS-CAP-FIN-014",
      "purpose": "Post fixed-asset depreciation for an accounting period through the governed posting RPC.",
      "sideEffect": "database_write",
      "actionType": "workflow",
      "required": [
        "accounting_entity_id",
        "asset_id",
        "period_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_depreciation_post"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "debt_schedule_run": {
      "action": "debt_schedule_run",
      "id": "BONDS-CAP-FIN-018",
      "purpose": "Build deterministic debt amortization, maturity and debt-service schedules from explicit facilities.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "debt_schedule_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "covenant_monitoring_run": {
      "action": "covenant_monitoring_run",
      "id": "BONDS-CAP-FIN-019",
      "purpose": "Evaluate deterministic financial covenant compliance, headroom and forecast breach periods.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "covenant_monitoring_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "credit_risk_run": {
      "action": "credit_risk_run",
      "id": "BONDS-CAP-FIN-020",
      "purpose": "Calculate deterministic PD/LGD/EAD expected loss and stress loss from explicit governed credit-risk parameters.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "credit_risk_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "treasury_liquidity_run": {
      "action": "treasury_liquidity_run",
      "id": "BONDS-CAP-FIN-021",
      "purpose": "Compute deterministic treasury cash position, liquidity headroom, funding gap, concentration and limits.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "treasury_liquidity_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "profitability_intelligence_run": {
      "action": "profitability_intelligence_run",
      "id": "BONDS-CAP-FIN-026",
      "purpose": "Compute deterministic profitability by customer, product, branch, project, segment or cost center using explicit direct and allocated costs.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "profitability_intelligence_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "unit_economics_run": {
      "action": "unit_economics_run",
      "id": "BONDS-CAP-FIN-027",
      "purpose": "Compute deterministic CAC, LTV, LTV-to-CAC, payback and unit contribution economics from explicit governed inputs.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "unit_economics_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "management_reporting_run": {
      "action": "management_reporting_run",
      "id": "BONDS-CAP-FIN-029",
      "purpose": "Compose deterministic CFO, board, monthly management and KPI packs from explicit actual, budget, prior-period, KPI, risk and action inputs.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "management_reporting_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "consolidation_run": {
      "action": "consolidation_run",
      "id": "BONDS-CAP-FIN-031",
      "purpose": "Run deterministic group consolidation with explicit ownership, NCI, intercompany eliminations and acquisition adjustments.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [
        "inputs"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "consolidation_engine"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_group_configure": {
      "action": "accounting_group_configure",
      "id": "BONDS-CAP-FIN-032",
      "purpose": "Configure a governed accounting group, parent entity, subsidiaries and ownership percentages without creating a parallel ledger.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "code",
        "members",
        "name",
        "parent_accounting_entity_id",
        "presentation_currency"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_group_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_intercompany_link": {
      "action": "accounting_intercompany_link",
      "id": "BONDS-CAP-FIN-033",
      "purpose": "Link a posted journal line to its intercompany counterparty within a governed accounting group for deterministic reconciliation and elimination.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "counterparty_accounting_entity_id",
        "group_id",
        "intercompany_class",
        "journal_line_id",
        "pair_key"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_intercompany_link"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_consolidation_report": {
      "action": "accounting_consolidation_report",
      "id": "BONDS-CAP-FIN-034",
      "purpose": "Read posted ledgers for every governed group member and produce a deterministic consolidated financial report with explicit intercompany eliminations.",
      "sideEffect": "none",
      "actionType": "data",
      "required": [
        "group_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_consolidation_report"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_cash_account_configure": {
      "action": "accounting_cash_account_configure",
      "id": "BONDS-CAP-FIN-035",
      "purpose": "Configure a governed cash or cash-equivalent account for an accounting entity without inferring cash status from account type alone.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "account_id",
        "accounting_entity_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_cash_account_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_cash_flow_policy_configure": {
      "action": "accounting_cash_flow_policy_configure",
      "id": "BONDS-CAP-FIN-036",
      "purpose": "Configure a deterministic operating, investing or financing cash-flow classification for a financial event type.",
      "sideEffect": "database_write",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "cash_flow_category",
        "event_type"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_cash_flow_policy_configure"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_dimension_cash_flow_statement": {
      "action": "accounting_dimension_cash_flow_statement",
      "id": "BONDS-CAP-FIN-037",
      "purpose": "Prepare a deterministic direct cash-flow statement by canonical cost-center or segment dimension with opening, closing and reconciliation controls.",
      "sideEffect": "none",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "dimension_type",
        "from",
        "to"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_dimension_cash_flow_statement"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "native_generate": {
      "action": "native_generate",
      "id": "BONDS-CAP-AI-001",
      "purpose": "Generate text through the configured Bonds Native Inference runtime.",
      "sideEffect": "compute",
      "actionType": "ai",
      "required": [
        "prompt"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "native_generate"
      },
      "serviceCode": "native-inference",
      "active": true
    },
    "native_health": {
      "action": "native_health",
      "id": "BONDS-CAP-AI-002",
      "purpose": "Inspect the configured Bonds Native Inference runtime.",
      "sideEffect": "none",
      "actionType": "ai",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "native_health"
      },
      "serviceCode": "native-inference",
      "active": true
    },
    "orchestrator_run": {
      "action": "orchestrator_run",
      "id": "BONDS-CAP-ORCH-001",
      "purpose": "Execute the Bonds intelligence orchestrator through the governed capability boundary.",
      "sideEffect": "compute",
      "actionType": "workflow",
      "required": [
        "request"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "orchestrator_run"
      },
      "serviceCode": "orchestrator",
      "active": true
    },
    "research_intelligence_verify": {
      "action": "research_intelligence_verify",
      "id": "BONDS-CAP-RI-001",
      "purpose": "Verify structured research evidence through the Bonds research intelligence engine.",
      "sideEffect": "none",
      "actionType": "engine",
      "required": [
        "sources"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "research_intelligence_verify"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "research_intelligence_synthesize": {
      "action": "research_intelligence_synthesize",
      "id": "BONDS-CAP-RI-002",
      "purpose": "Synthesize verified research while preserving provenance and uncertainty.",
      "sideEffect": "none",
      "actionType": "engine",
      "required": [
        "sources"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "research_intelligence_synthesize"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "evidence_graph_analyze": {
      "action": "evidence_graph_analyze",
      "id": "BONDS-CAP-RI-003",
      "purpose": "Build an evidence and provenance graph, identify conflicts and measure evidence integrity.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "evidence_graph_analyze"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "blind_spot_analyze": {
      "action": "blind_spot_analyze",
      "id": "BONDS-CAP-RI-004",
      "purpose": "Detect missing inputs, missing engines, weak confidence and contradictions in a decision context.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "blind_spot_analyze"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "decision_graph_build": {
      "action": "decision_graph_build",
      "id": "BONDS-CAP-RI-005",
      "purpose": "Build the BONDS decision graph and identify the critical path, bottleneck and next best action.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "decision_graph_build"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "recommendation_synthesize": {
      "action": "recommendation_synthesize",
      "id": "BONDS-CAP-RI-006",
      "purpose": "Synthesize governed engine results and blind spots into ranked explainable recommendations.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "recommendation_synthesize"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "event_monitor_analyze": {
      "action": "event_monitor_analyze",
      "id": "BONDS-CAP-RI-007",
      "purpose": "Evaluate registered BONDS alert rules in dry-run mode without persistence or notifications.",
      "sideEffect": "compute",
      "actionType": "engine",
      "required": [],
      "requiredAny": [],
      "runtime": {
        "adapter": "event_monitor_analyze"
      },
      "serviceCode": "research-intelligence",
      "active": true
    },
    "web_search": {
      "action": "web_search",
      "id": "BONDS-CAP-WEB-000",
      "purpose": "Search the public web from a free-text query and return bounded result URLs and snippets for governed follow-up acquisition.",
      "sideEffect": "network_read",
      "actionType": "api",
      "required": [
        "query"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "web_search"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "web_fetch": {
      "action": "web_fetch",
      "id": "BONDS-CAP-WEB-001",
      "purpose": "Fetch one public HTTP/HTTPS resource with SSRF protection and evidence hashing.",
      "sideEffect": "network_read",
      "actionType": "api",
      "required": [
        "url"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "web_fetch"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "web_crawl": {
      "action": "web_crawl",
      "id": "BONDS-CAP-WEB-002",
      "purpose": "Run a bounded multi-page crawl with host/depth/page budgets.",
      "sideEffect": "network_read",
      "actionType": "api",
      "required": [],
      "requiredAny": [
        [
          "url",
          "seedUrls",
          "seed_urls"
        ]
      ],
      "runtime": {
        "adapter": "web_crawl"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "web_explore": {
      "action": "web_explore",
      "id": "BONDS-CAP-WEB-003",
      "purpose": "Fetch, crawl and extract evidence-bearing content.",
      "sideEffect": "network_read",
      "actionType": "api",
      "required": [],
      "requiredAny": [
        [
          "url",
          "seedUrls",
          "seed_urls"
        ]
      ],
      "runtime": {
        "adapter": "web_explore"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "evidence_verify": {
      "action": "evidence_verify",
      "id": "BONDS-CAP-RSCH-001",
      "purpose": "Verify evidence, independence and contradictions.",
      "sideEffect": "none",
      "actionType": "engine",
      "required": [
        "sources"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "evidence_verify"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "research_synthesize": {
      "action": "research_synthesize",
      "id": "BONDS-CAP-RSCH-002",
      "purpose": "Synthesize verified research while preserving provenance.",
      "sideEffect": "none",
      "actionType": "engine",
      "required": [
        "sources"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "research_synthesize"
      },
      "serviceCode": "web-research",
      "active": true
    },
    "accounting_trial_balance_report": {
      "action": "accounting_trial_balance_report",
      "id": "BONDS-CAP-FIN-038",
      "purpose": "Read a deterministic trial balance from posted canonical ledger journals for an Accounting Entity the signed-in user can access.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "accounting_entity_id"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_trial_balance_report"
      },
      "serviceCode": "financial-engine",
      "active": true
    },
    "accounting_financial_statements_report": {
      "action": "accounting_financial_statements_report",
      "id": "BONDS-CAP-FIN-039",
      "purpose": "Prepare deterministic financial statements from posted canonical ledger journals for an Accounting Entity the signed-in user can access.",
      "sideEffect": "database_read",
      "actionType": "data",
      "required": [
        "accounting_entity_id",
        "from",
        "to"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "accounting_financial_statements_report"
      },
      "serviceCode": "financial-engine",
      "active": true
    }
  },
  "governance": {
    "permissions": [
      "agent.runtime.execute",
      "ai.native.use",
      "orchestrator.execute",
      "research.intelligence.execute"
    ],
    "entitlements": [
      "agent.runtime",
      "ai.native",
      "orchestrator",
      "research.intelligence",
      "research.web"
    ],
    "featureFlags": [
      {
        "key": "service.agent-runtime.enabled",
        "defaultEnabled": false
      },
      {
        "key": "service.native-inference.enabled",
        "defaultEnabled": true
      },
      {
        "key": "service.orchestrator.enabled",
        "defaultEnabled": true
      },
      {
        "key": "service.research-intelligence.enabled",
        "defaultEnabled": true
      },
      {
        "key": "service.web-research.enabled",
        "defaultEnabled": true
      }
    ],
    "workflowEvents": [
      "agent.runtime.completed",
      "assistant.calculate.completed",
      "assistant.read.completed",
      "native-inference.health",
      "orchestrator.completed",
      "research.completed",
      "research.intelligence.completed"
    ]
  }
});
