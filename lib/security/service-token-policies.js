'use strict';

const DEFAULT_ISSUER =
  process.env.BONDS_TOKEN_ISSUER ||
  'bonds-token-service';

const SERVICE_TOKEN_POLICIES = Object.freeze({
  'web-research': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'web-research',
    subjectPrefix: 'service:',
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
    subjectPrefix: 'service:',
    scopes: ['research:read']
  }),
  orchestrator: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'orchestrator',
    subjectPrefix: 'service:',
    scopes: ['orchestrator:dispatch']
  }),
  'agent-runtime': Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'agent-runtime',
    subjectPrefix: 'service:',
    scopes: ['agent:execute']
  }),
  marketing: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'marketing',
    subjectPrefix: 'service:',
    scopes: ['marketing:read']
  }),
  monitoring: Object.freeze({
    issuer: DEFAULT_ISSUER,
    audience: 'monitoring',
    subjectPrefix: 'service:',
    scopes: ['monitoring:read']
  })
});

function getServiceTokenPolicy(serviceCode, capabilityAction = null) {
  const base = SERVICE_TOKEN_POLICIES[String(serviceCode || '').trim()] || null;
  if (!base) return null;

  const capabilityScopes =
    capabilityAction &&
    base.capabilityScopes &&
    base.capabilityScopes[String(capabilityAction).trim()];

  if (!capabilityScopes) return base;

  return {
    ...base,
    scopes: capabilityScopes
  };
}

module.exports = {
  DEFAULT_ISSUER,
  SERVICE_TOKEN_POLICIES,
  getServiceTokenPolicy
};
