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
      "version": 2,
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
      "version": 1,
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
      "version": 1,
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
      "version": 1,
      "enabled": true,
      "governance": {
        "permissions": [
          "research.web.read"
        ],
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
    "financial_analysis_run": {
      "action": "financial_analysis_run",
      "id": "BONDS-CAP-FIN-001",
      "purpose": "Run deterministic financial statement and ratio analysis.",
      "sideEffect": "compute",
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
    "native_generate": {
      "action": "native_generate",
      "id": "BONDS-CAP-AI-001",
      "purpose": "Generate text through the configured Bonds Native Inference runtime.",
      "sideEffect": "compute",
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
    "web_fetch": {
      "action": "web_fetch",
      "id": "BONDS-CAP-WEB-001",
      "purpose": "Fetch one public HTTP/HTTPS resource with SSRF protection and evidence hashing.",
      "sideEffect": "network_read",
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
      "required": [
        "sources"
      ],
      "requiredAny": [],
      "runtime": {
        "adapter": "research_synthesize"
      },
      "serviceCode": "web-research",
      "active": true
    }
  },
  "governance": {
    "permissions": [
      "agent.runtime.execute",
      "ai.native.use",
      "orchestrator.execute",
      "research.intelligence.execute",
      "research.web.read"
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
