'use strict';

const {
  DEFAULT_CLOCK_SKEW_SECONDS
} = require('./service-token-authorization');

const DEFAULT_ISSUER =
  process.env.BONDS_TOKEN_ISSUER ||
  'bonds-token-service';

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
    scopes: ['research:read']
  }),
  orchestrator: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'orchestrator',
    allowedSubjects: Object.freeze([
      'service:agent-runtime'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
    scopes: ['orchestrator:dispatch']
  }),
  'agent-runtime': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'agent-runtime',
    allowedSubjects: Object.freeze([
      'service:orchestrator'
    ]),
    clockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
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
  SERVICE_TOKEN_POLICIES,
  getServiceTokenPolicy
};
