'use strict';

const {
  DEFAULT_CLOCK_SKEW_SECONDS
} = require('./service-token-authorization');

const DEFAULT_ISSUER =
  process.env.BONDS_TOKEN_ISSUER ||
  'bonds-token-service';

// Security ceiling, not the issuer TTL. Individual protected-service policies
// must use the documented token-service TTL (or a stricter value) and stay
// within this bound.
const MAX_SERVICE_TOKEN_AGE_SECONDS = 3600;

const SERVICE_TOKEN_POLICIES = Object.freeze({
  'web-research': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'web-research',
    allowedSubjects: Object.freeze([
      'service:research-intelligence'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    scopes: ['research:read'],
    capabilityScopes: Object.freeze({
      web_fetch: ['research:read'],
      web_crawl: ['crawl:read'],
      web_explore: ['crawl:read'],
      evidence_verify: ['research:read'],
      research_synthesize: ['research:read']
    })
  }),
  'research-intelligence': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'research-intelligence',
    allowedSubjects: Object.freeze([
      'service:orchestrator'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    maxTokenAgeSeconds: null,
    scopes: ['research:read']
  }),
  orchestrator: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'orchestrator',
    allowedSubjects: Object.freeze([
      'service:agent-runtime'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    maxTokenAgeSeconds: null,
    scopes: ['orchestrator:dispatch']
  }),
  'agent-runtime': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'agent-runtime',
    allowedSubjects: Object.freeze([
      'service:orchestrator'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    maxTokenAgeSeconds: null,
    scopes: ['agent:execute']
  }),
  marketing: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'marketing',
    allowedSubjects: Object.freeze([
      'service:orchestrator'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    scopes: ['marketing:read']
  }),
  monitoring: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'monitoring',
    allowedSubjects: Object.freeze([
      'service:orchestrator'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    scopes: ['monitoring:read']
  })
});

function isValidMaxTokenAgeSeconds(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_SERVICE_TOKEN_AGE_SECONDS
  );
}

function getServiceTokenPolicy(serviceCode, capabilityAction = null) {
  const base =
    SERVICE_TOKEN_POLICIES[String(serviceCode || '').trim()] ||
    null;

  if (!base) return null;

  const capabilityScopes =
    capabilityAction &&
    base.capabilityScopes &&
    base.capabilityScopes[String(capabilityAction).trim()];

  if (!capabilityScopes) return base;

  return Object.freeze({
    ...base,
    scopes: capabilityScopes
  });
}

module.exports = {
  DEFAULT_ISSUER,
  MAX_SERVICE_TOKEN_AGE_SECONDS,
  SERVICE_TOKEN_POLICIES,
  isValidMaxTokenAgeSeconds,
  getServiceTokenPolicy
};
