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
      "native-inference.health",
      "orchestrator.completed",
      "research.completed",
      "research.intelligence.completed"
    ]
  }
});
