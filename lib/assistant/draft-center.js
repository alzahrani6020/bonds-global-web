'use strict';

const DRAFT_CENTER_VERSION = 1;

const DRAFT_SOURCES = Object.freeze([
  { form_code:'kyc', table:'client_kyc_cases', subject_type:null },
  { form_code:'establishment', table:'client_establishment_profiles', subject_type:null },
  { form_code:'activity', table:'client_business_activity_profiles', subject_type:null },
  { form_code:'cash_flow', table:'client_cash_flow_reports', subject_type:null },
  { form_code:'receivables', table:'client_receivables_aging_reports', subject_type:null },
  { form_code:'payables', table:'client_payables_aging_reports', subject_type:null },
  { form_code:'credit_business', table:'client_credit_consents', subject_type:'business' },
  { form_code:'credit_individual', table:'client_credit_consents', subject_type:'individual' }
]);

const EDITABLE_STATUSES = new Set(['draft','additional_information_required']);

function cleanString(value, maxLength = 300) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeDraftRow(source, row) {
  if (!row || typeof row !== 'object') return null;
  const status = cleanString(row.status, 80) || 'draft';
  return {
    id:row.id || null,
    form_code:source.form_code,
    table:source.table,
    status,
    editable:EDITABLE_STATUSES.has(status),
    client_id:row.client_id || null,
    funding_case_id:row.funding_case_id || null,
    updated_at:row.updated_at || row.created_at || null,
    created_at:row.created_at || null,
    navigation_target:source.form_code,
    source:'existing_form_draft'
  };
}

async function listOwnedDrafts({ supabase, userId, limitPerSource = 20 }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('DRAFT_CENTER_UNAVAILABLE');
  if (!userId) throw new Error('DRAFT_CENTER_USER_REQUIRED');

  const safeLimit = Number.isInteger(limitPerSource)
    ? Math.max(1, Math.min(limitPerSource, 50))
    : 20;

  const results = await Promise.all(DRAFT_SOURCES.map(async source => {
    let query = supabase
      .from(source.table)
      .select('id,user_id,client_id,funding_case_id,status,created_at,updated_at')
      .eq('user_id', userId)
      .in('status', Array.from(EDITABLE_STATUSES))
      .order('updated_at', { ascending:false })
      .limit(safeLimit);

    if (source.subject_type) {
      query = query.eq('subject_type', source.subject_type);
    }

    const { data, error } = await query;
    if (error) {
      return {
        source:source.form_code,
        drafts:[],
        error:'DRAFT_SOURCE_UNAVAILABLE'
      };
    }

    return {
      source:source.form_code,
      drafts:Array.isArray(data)
        ? data.map(row => normalizeDraftRow(source, row)).filter(Boolean)
        : [],
      error:null
    };
  }));

  const drafts = results
    .flatMap(item => item.drafts)
    .sort((a,b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

  return {
    version:DRAFT_CENTER_VERSION,
    drafts,
    partial:results.some(item => item.error),
    source_status:results.map(item => ({
      form_code:item.source,
      status:item.error ? 'unavailable' : 'ok'
    })),
    policy:{
      read_only:true,
      submit_allowed:false,
      write_allowed:false,
      execution_authorized:false
    }
  };
}

module.exports = {
  DRAFT_CENTER_VERSION,
  DRAFT_SOURCES,
  EDITABLE_STATUSES,
  normalizeDraftRow,
  listOwnedDrafts
};
