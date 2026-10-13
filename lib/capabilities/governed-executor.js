'use strict';

const { fetchUrl, crawl } = require('../intelligence/web-acquisition');
const { extractContent } = require('../intelligence/content-extraction');
const { verifyEvidence, synthesizeResearch } = require('../intelligence/research-intelligence');
const { validateCapabilityInput } = require('./bonds-capability-registry');
const { getInferenceRouter } = require('../ai/inference-router');

async function executeCapability(action, input = {}, context = {}) {
  const validation = validateCapabilityInput(action, input);
  if (!validation.valid) {
    return {
      ok: false,
      executed: false,
      action,
      error: { code: validation.code, missing: validation.missing },
      httpStatus: validation.code === 'UNKNOWN_CAPABILITY' ? 404 : 400
    };
  }

  switch (action) {
    case 'web_fetch': {
      const result = await fetchUrl(input.url, input.options || {});
      return { ok: result.ok, executed: result.executed, action, evidence: { fetch: result.evidence },
        result: { text: result.text, content_type: result.evidence.content_type } };
    }
    case 'web_crawl': {
      const result = await crawl(input);
      return { ok: result.pages.length > 0, executed: true, action, evidence: { coverage: result.coverage },
        result: { pages: result.pages.map(p => ({ url: p.url, depth: p.depth, evidence: p.evidence })), failures: result.failures } };
    }
    case 'web_explore': {
      const result = await crawl(input);
      const pages = [];
      for (const page of result.pages) {
        const extracted = await extractContent(page.body, page.evidence.content_type);
        pages.push({ url: page.url, depth: page.depth, evidence: page.evidence, extracted });
      }
      return { ok: pages.length > 0, executed: true, action,
        evidence: { coverage: result.coverage, content_hashes: pages.map(p => p.evidence.content_hash).filter(Boolean) },
        result: { pages, failures: result.failures, blocked: result.blocked } };
    }
    case 'evidence_verify':
      return { action, ...verifyEvidence(input) };
    case 'research_synthesize':
      return { action, ...synthesizeResearch(input) };
    case 'native_health':
      return { action, ...(await getInferenceRouter(context).health()) };
    case 'native_generate':
      return { action, ...(await getInferenceRouter(context).generate(input.prompt, input)) };
    default:
      return { ok: false, executed: false, action, error: { code: 'UNKNOWN_CAPABILITY' } };
  }
}

module.exports = { executeCapability };
