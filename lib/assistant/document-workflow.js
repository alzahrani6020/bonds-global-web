'use strict';

const { analyzeDocumentForAssistant, loadOwnedDocument } = require('./document-intelligence');

const DOCUMENT_REQUIREMENT_MAP = Object.freeze({
  identity_document: [
    { requirement_code:'kyc', confidence:0.98, reason:'identity_supports_kyc' }
  ],
  commercial_registration: [
    { requirement_code:'establishment', confidence:0.97, reason:'commercial_registration_supports_establishment' }
  ],
  tax_certificate: [
    { requirement_code:'establishment', confidence:0.92, reason:'tax_certificate_supports_establishment' }
  ],
  bank_statement: [
    { requirement_code:'cash_flow', confidence:0.92, reason:'bank_statement_supports_cash_flow' }
  ],
  financial_statement: [
    { requirement_code:'cash_flow', confidence:0.90, reason:'financial_statement_supports_cash_flow' }
  ],
  feasibility_study: [
    { requirement_code:'activity', confidence:0.82, reason:'feasibility_study_supports_business_activity' }
  ],
  invoice: [
    { requirement_code:'receivables', confidence:0.62, reason:'invoice_may_support_receivables' },
    { requirement_code:'payables', confidence:0.62, reason:'invoice_may_support_payables' }
  ],
  contract: [
    { requirement_code:'activity', confidence:0.60, reason:'contract_may_support_business_activity' }
  ],
  unknown: []
});

function completedRequirement(requirement, submission) {
  if (!requirement || !submission) return false;
  const statuses = Array.isArray(requirement.completion_statuses)
    ? requirement.completion_statuses
    : [];
  return statuses.includes(submission.status);
}

function buildWorkflowSuggestions({ document, requirements, submissions }) {
  const analysis = document.assistant_analysis || analyzeDocumentForAssistant(document);
  const mappings = DOCUMENT_REQUIREMENT_MAP[analysis.classification.type] || [];
  const requirementByCode = new Map((requirements || []).map(row => [row.code, row]));
  const submissionByRequirementId = new Map((submissions || []).map(row => [row.requirement_id, row]));

  const suggestions = [];
  for (const mapping of mappings) {
    const requirement = requirementByCode.get(mapping.requirement_code);
    if (!requirement || requirement.is_active === false) continue;

    const submission = submissionByRequirementId.get(requirement.id);
    if (completedRequirement(requirement, submission)) continue;

    suggestions.push({
      requirement_id:requirement.id,
      requirement_code:requirement.code,
      stage_id:requirement.stage_id,
      label_ar:requirement.label_ar,
      label_en:requirement.label_en,
      confidence:Math.min(mapping.confidence, analysis.classification.confidence || mapping.confidence),
      reason:mapping.reason,
      current_status:submission ? submission.status : 'not_started',
      provenance:{
        source:'assistant_document_classification',
        document_id:document.id,
        document_type:analysis.classification.type,
        classification_confidence:analysis.classification.confidence
      },
      policy:{
        suggestion_only:true,
        auto_submit:false,
        requires_user_confirmation:true
      }
    });
  }

  return {
    document_id:document.id,
    document_type:analysis.classification.type,
    document_confidence:analysis.classification.confidence,
    suggestions,
    blocked_from_auto_write:true
  };
}

async function verifyOwnedFundingCase({ supabase, userId, caseId }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('WORKFLOW_STORE_UNAVAILABLE');
  if (!userId) throw new Error('WORKFLOW_USER_REQUIRED');
  if (!caseId) throw new Error('FUNDING_CASE_ID_REQUIRED');

  const { data, error } = await supabase
    .from('funding_cases')
    .select('id,user_id,project_id,status,case_reference')
    .eq('id', String(caseId))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error('FUNDING_CASE_LOOKUP_FAILED');
  return data || null;
}

async function suggestDocumentWorkflow({ supabase, userId, documentId, caseId }) {
  const fundingCase = await verifyOwnedFundingCase({ supabase, userId, caseId });
  if (!fundingCase) return null;

  const document = await loadOwnedDocument({
    supabase,
    userId,
    documentId
  });
  if (!document) return null;

  if (document.project_id && fundingCase.project_id && String(document.project_id) !== String(fundingCase.project_id)) {
    throw new Error('DOCUMENT_CASE_PROJECT_CONFLICT');
  }

  const [{ data:requirements, error:reqError }, { data:submissions, error:subError }] = await Promise.all([
    supabase
      .from('funding_file_requirements')
      .select('id,code,stage_id,label_ar,label_en,is_active,completion_statuses')
      .eq('is_active', true),
    supabase
      .from('funding_case_submissions')
      .select('requirement_id,status,source_record_id,updated_at')
      .eq('case_id', fundingCase.id)
  ]);

  if (reqError || subError) throw new Error('FUNDING_WORKFLOW_LOOKUP_FAILED');

  return {
    case_id:fundingCase.id,
    case_reference:fundingCase.case_reference || null,
    ...buildWorkflowSuggestions({
      document,
      requirements:requirements || [],
      submissions:submissions || []
    })
  };
}

module.exports = {
  DOCUMENT_REQUIREMENT_MAP,
  completedRequirement,
  buildWorkflowSuggestions,
  verifyOwnedFundingCase,
  suggestDocumentWorkflow
};
