'use strict';

const STAGE_SCORE = Object.freeze({
  lead: 20,
  qualified: 40,
  proposal: 60,
  negotiation: 80,
  won: 100,
  lost: 0
});

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function present(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function classify(score) {
  if (score === null) return 'unknown';
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'developing';
  return 'weak';
}

function confidenceFromCoverage(coveragePct) {
  if (!Number.isFinite(coveragePct) || coveragePct <= 0) return 'unknown';
  if (coveragePct >= 80) return 'high';
  if (coveragePct >= 60) return 'medium';
  return 'low';
}

function summarizeComponents(components) {
  const entries = Object.entries(components);
  const available = entries.filter(([, item]) => item && item.score !== null && item.score !== undefined);
  const score = available.length
    ? round(available.reduce((sum, [, item]) => sum + clamp(Number(item.score)), 0) / available.length)
    : null;
  const coverage = entries.length ? round((available.length / entries.length) * 100) : 0;

  return {
    score,
    classification: classify(score),
    confidence: confidenceFromCoverage(coverage),
    coverage,
    reasons: available.map(([key, item]) => ({
      key,
      label: item.label,
      score: round(clamp(Number(item.score))),
      evidence: item.evidence || null
    })),
    missingEvidence: entries
      .filter(([, item]) => !item || item.score === null || item.score === undefined)
      .map(([key, item]) => ({ key, label: item?.label || key })),
    methodology: 'rule_based_v1',
    semantics: 'operational_prioritization_not_conversion_probability'
  };
}

function engagementScore(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    return { score: 0, evidence: 'no_linked_service_requests' };
  }

  const ranks = {
    draft: 20,
    submitted: 40,
    triage: 60,
    in_progress: 80,
    awaiting_client: 80,
    awaiting_approval: 90,
    completed: 100,
    cancelled: 0
  };

  let best = 0;
  let bestStatus = 'unknown';
  for (const row of requests) {
    const status = String(row?.status || '').trim();
    const value = Object.prototype.hasOwnProperty.call(ranks, status) ? ranks[status] : 40;
    if (value >= best) {
      best = value;
      bestStatus = status || 'unknown';
    }
  }

  return {
    score: best,
    evidence: requests.length + ' linked request(s); strongest=' + bestStatus
  };
}

function scoreLead(client, serviceRequests = []) {
  const linkedRequests = (serviceRequests || []).filter(row => row?.client_id && row.client_id === client?.id);

  const decisionMaker =
    client?.is_decision_maker === true ? 100 :
    client?.is_decision_maker === false ? 0 :
    null;

  const components = {
    contactability: {
      label: 'Contactability',
      score: present(client?.email) || present(client?.phone) ? 100 : 0,
      evidence: present(client?.email) && present(client?.phone)
        ? 'email_and_phone'
        : present(client?.email) ? 'email' : present(client?.phone) ? 'phone' : 'no_contact_channel'
    },
    companyContext: {
      label: 'Company context',
      score: present(client?.company_name) || present(client?.organization_id) ? 100 : null,
      evidence: present(client?.company_name) ? 'company_name' : present(client?.organization_id) ? 'organization_link' : null
    },
    decisionRole: {
      label: 'Decision-maker status',
      score: decisionMaker,
      evidence: decisionMaker === null ? null : (decisionMaker === 100 ? 'decision_maker=true' : 'decision_maker=false')
    },
    relationshipRole: {
      label: 'Relationship role',
      score: present(client?.relationship_role) ? 100 : null,
      evidence: present(client?.relationship_role) ? String(client.relationship_role) : null
    },
    sourceAttribution: {
      label: 'Lead source',
      score: present(client?.source) ? 100 : null,
      evidence: present(client?.source) ? String(client.source) : null
    },
    engagement: {
      label: 'Service-request engagement',
      ...engagementScore(linkedRequests)
    }
  };

  return summarizeComponents(components);
}

function scoreOpportunity(opportunity) {
  const probability = finite(opportunity?.probability);
  const stage = String(opportunity?.stage || '').trim();
  const stageScore = Object.prototype.hasOwnProperty.call(STAGE_SCORE, stage)
    ? STAGE_SCORE[stage]
    : null;

  let actionPlan = null;
  let actionEvidence = null;
  const hasAction = present(opportunity?.next_action);
  const hasActionDate = present(opportunity?.next_action_at);
  if (hasAction && hasActionDate) {
    actionPlan = 100;
    actionEvidence = 'next_action_and_date';
  } else if (hasAction || hasActionDate) {
    actionPlan = 60;
    actionEvidence = hasAction ? 'next_action_only' : 'next_action_date_only';
  }

  const components = {
    probability: {
      label: 'CRM probability',
      score: probability === null ? null : clamp(probability),
      evidence: probability === null ? null : String(clamp(probability)) + '%'
    },
    stageMaturity: {
      label: 'Pipeline stage maturity',
      score: stageScore,
      evidence: stageScore === null ? null : stage
    },
    valueQualified: {
      label: 'Qualified deal value',
      score: finite(opportunity?.value_amount) > 0 ? 100 : null,
      evidence: finite(opportunity?.value_amount) > 0 ? 'value_amount_present' : null
    },
    closePlan: {
      label: 'Expected close date',
      score: present(opportunity?.expected_close_date) ? 100 : null,
      evidence: present(opportunity?.expected_close_date) ? String(opportunity.expected_close_date) : null
    },
    ownership: {
      label: 'Assigned owner',
      score: present(opportunity?.owner_user_id) ? 100 : null,
      evidence: present(opportunity?.owner_user_id) ? 'owner_assigned' : null
    },
    actionPlan: {
      label: 'Next-action plan',
      score: actionPlan,
      evidence: actionEvidence
    },
    serviceLink: {
      label: 'Service-request linkage',
      score: present(opportunity?.service_request_id) ? 100 : null,
      evidence: present(opportunity?.service_request_id) ? 'service_request_linked' : null
    }
  };

  return summarizeComponents(components);
}

function averageScore(rows) {
  const scores = (rows || []).map(row => finite(row?.commercial_score?.score)).filter(v => v !== null);
  return scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
}

function buildCommercialScoring(clients = [], opportunities = [], serviceRequests = []) {
  const scoredClients = (clients || []).map(client => ({
    ...client,
    commercial_score: scoreLead(client, serviceRequests)
  }));

  const scoredOpportunities = (opportunities || []).map(opportunity => ({
    ...opportunity,
    commercial_score: scoreOpportunity(opportunity)
  }));

  const confidenceCounts = rows => rows.reduce((acc, row) => {
    const key = row?.commercial_score?.confidence || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0, unknown: 0 });

  return {
    clients: scoredClients,
    opportunities: scoredOpportunities,
    summary: {
      leadScoring: {
        status: scoredClients.length ? 'active' : 'empty',
        entityCount: scoredClients.length,
        averageScore: averageScore(scoredClients),
        confidence: confidenceCounts(scoredClients)
      },
      opportunityScoring: {
        status: scoredOpportunities.length ? 'active' : 'empty',
        entityCount: scoredOpportunities.length,
        averageScore: averageScore(scoredOpportunities),
        confidence: confidenceCounts(scoredOpportunities)
      },
      methodology: 'rule_based_v1',
      persisted: false,
      generatedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  STAGE_SCORE,
  scoreLead,
  scoreOpportunity,
  buildCommercialScoring
};
