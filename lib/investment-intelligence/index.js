/**
 * BONDS Investment Intelligence Suite — Phase D.1 Public API
 *
 * Foundation + Core Intelligence:
 *   - Investment Readiness
 *   - Investment Memorandum
 *   - Investment Story
 *   - AI Investment Review
 *   - Versioning
 *   - Document Generator (HTML)
 */

const { resolveProjectContext } = require('./project-resolver');
const { InvestmentReadinessEngine } = require('./investment-readiness-engine');
const { InvestmentMemorandumEngine } = require('./investment-memorandum-engine');
const { InvestmentStoryEngine } = require('./investment-story-engine');
const { AiInvestmentReviewEngine } = require('./ai-investment-review');
const { VersioningEngine, diffObjects } = require('./versioning-engine');
const { toHtml } = require('./document-generator');

async function evaluateReadiness({ projectId, supabase, projectData }) {
  const context = await resolveProjectContext({ projectId, supabase, projectData });
  const engine = new InvestmentReadinessEngine(context);
  return engine.evaluate();
}

async function generateMemorandum({ projectId, supabase, projectData, options = {} }) {
  const context = await resolveProjectContext({ projectId, supabase, projectData });
  const engine = new InvestmentMemorandumEngine(context, options);
  return engine.generate();
}

async function generateStory({ projectId, supabase, projectData, options = {} }) {
  const context = await resolveProjectContext({ projectId, supabase, projectData });
  const engine = new InvestmentStoryEngine(context, options);
  return engine.generate();
}

async function reviewMemorandum(memorandum, options = {}) {
  const engine = new AiInvestmentReviewEngine(memorandum, options);
  return engine.review();
}

module.exports = {
  resolveProjectContext,
  evaluateReadiness,
  generateMemorandum,
  generateStory,
  reviewMemorandum,
  VersioningEngine,
  diffObjects,
  toHtml,
  InvestmentReadinessEngine,
  InvestmentMemorandumEngine,
  InvestmentStoryEngine,
  AiInvestmentReviewEngine
};
