'use strict';

const CAPABILITIES = Object.freeze({
  web_fetch: {
    id: 'BONDS-CAP-WEB-001',
    purpose: 'Fetch one public HTTP/HTTPS resource with SSRF protection and evidence hashing.',
    sideEffect: 'network_read',
    required: ['url']
  },
  web_crawl: {
    id: 'BONDS-CAP-WEB-002',
    purpose: 'Run a bounded multi-page crawl with host/depth/page budgets.',
    sideEffect: 'network_read',
    requiredAny: [['url', 'seedUrls', 'seed_urls']]
  },
  web_explore: {
    id: 'BONDS-CAP-WEB-003',
    purpose: 'Fetch/crawl and extract content into evidence-bearing observations.',
    sideEffect: 'network_read',
    requiredAny: [['url', 'seedUrls', 'seed_urls']]
  },
  evidence_verify: {
    id: 'BONDS-CAP-RSCH-001',
    purpose: 'Verify supplied sources, independence, contradictions and claim promotion eligibility.',
    sideEffect: 'none',
    required: ['sources']
  },
  research_synthesize: {
    id: 'BONDS-CAP-RSCH-002',
    purpose: 'Synthesize verified research while preserving provenance, contradictions and unknowns.',
    sideEffect: 'none',
    required: ['sources']
  },
  native_generate: {
    id: 'BONDS-CAP-AI-001',
    purpose: 'Generate text through the configured Bonds Native Inference runtime.',
    sideEffect: 'compute',
    required: ['prompt']
  },
  native_health: {
    id: 'BONDS-CAP-AI-002',
    purpose: 'Inspect the configured Bonds Native Inference runtime without generation.',
    sideEffect: 'none'
  }
});

function getCapability(action) {
  return CAPABILITIES[String(action || '').trim()] || null;
}

function listCapabilities() {
  return Object.entries(CAPABILITIES).map(([action, spec]) => ({ action, ...spec }));
}

function validateCapabilityInput(action, input = {}) {
  const spec = getCapability(action);
  if (!spec) return { valid: false, code: 'UNKNOWN_CAPABILITY', missing: [] };
  const missing = (spec.required || []).filter(key => input[key] === undefined || input[key] === null || input[key] === '');
  for (const group of spec.requiredAny || []) {
    if (!group.some(key => input[key] !== undefined && input[key] !== null && input[key] !== '')) {
      missing.push(group.join('|'));
    }
  }
  return { valid: missing.length === 0, code: missing.length ? 'MISSING_INPUTS' : null, missing, spec };
}

module.exports = { CAPABILITIES, getCapability, listCapabilities, validateCapabilityInput };
