'use strict';

const { fetchUrl, crawl } =
  require('../intelligence/web-acquisition');

const { extractContent } =
  require('../intelligence/content-extraction');

const {
  verifyEvidence,
  synthesizeResearch
} = require('../intelligence/research-intelligence');

const {
  getInferenceRouter
} = require('../ai/inference-router');

const intelligenceOrchestrator =
  require('../orchestrator/intelligence-orchestrator');


function publicNetworkInput(input = {}) {
  return {
    ...input,
    allowPrivateNetworks: false,
    allow_private_networks: false
  };
}

function publicFetchOptions(options = {}) {
  return {
    ...options,
    allowPrivateNetworks: false
  };
}


const RUNTIME_ADAPTERS = Object.freeze({

  web_fetch: async (input) => {
    const result = await fetchUrl(
      input.url,
      publicFetchOptions(input.options)
    );

    return {
      ok: result.ok,
      executed: result.executed,
      evidence: {
        fetch: result.evidence
      },
      result: {
        text: result.text,
        content_type: result.evidence.content_type
      }
    };
  },


  web_crawl: async (input) => {
    const result = await crawl(
      publicNetworkInput(input)
    );

    return {
      ok: result.pages.length > 0,
      executed: true,
      evidence: {
        coverage: result.coverage
      },
      result: {
        pages: result.pages.map(page => ({
          url: page.url,
          depth: page.depth,
          evidence: page.evidence
        })),
        failures: result.failures
      }
    };
  },


  web_explore: async (input) => {
    const result = await crawl(
      publicNetworkInput(input)
    );

    const pages = [];

    for (const page of result.pages) {
      const extracted = await extractContent(
        page.body,
        page.evidence.content_type
      );

      pages.push({
        url: page.url,
        depth: page.depth,
        evidence: page.evidence,
        extracted
      });
    }

    return {
      ok: pages.length > 0,
      executed: true,
      evidence: {
        coverage: result.coverage,
        content_hashes: pages
          .map(page => page.evidence.content_hash)
          .filter(Boolean)
      },
      result: {
        pages,
        failures: result.failures,
        blocked: result.blocked
      }
    };
  },


  evidence_verify: async (input) =>
    verifyEvidence(input),


  research_synthesize: async (input) =>
    synthesizeResearch(input),


  research_intelligence_verify: async (input) =>
    verifyEvidence(input),


  research_intelligence_synthesize: async (input) =>
    synthesizeResearch(input),


  orchestrator_run: async (input) => ({
    ok: true,
    executed: true,
    result:
      await intelligenceOrchestrator.run(input.request)
  }),


  native_health: async (_input, context) =>
    getInferenceRouter(context).health(),


  native_generate: async (input, context) =>
    getInferenceRouter(context).generate(
      input.prompt,
      input
    )
});


function getRuntimeAdapter(name) {
  return RUNTIME_ADAPTERS[
    String(name || '').trim()
  ] || null;
}


module.exports = {
  RUNTIME_ADAPTERS,
  getRuntimeAdapter
};
