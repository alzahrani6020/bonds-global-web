'use strict';

module.exports = Object.freeze({
  "services": {
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
        "requestsPerMinute": 30,
        "retryMaxAttempts": 1
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
        "requestsPerMinute": 60,
        "retryMaxAttempts": 2
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
      "ai.native.use",
      "research.web.read"
    ],
    "entitlements": [
      "ai.native",
      "research.web"
    ],
    "featureFlags": [
      {
        "key": "service.native-inference.enabled",
        "defaultEnabled": true
      },
      {
        "key": "service.web-research.enabled",
        "defaultEnabled": true
      }
    ],
    "workflowEvents": [
      "native-inference.health",
      "research.completed"
    ]
  }
});
