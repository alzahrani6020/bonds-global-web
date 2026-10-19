(function () {
  'use strict';

  function readCaseId() {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('case') || params.get('funding_case_id') || null;
  }

  function withCase(href, caseId) {
    if (!caseId) return href;
    const url = new URL(href, window.location.origin);
    url.searchParams.set('case', caseId);
    return url.pathname + url.search + url.hash;
  }

  async function resolve(sb, user) {
    const caseId = readCaseId();
    if (!caseId || !sb || !user?.id) return null;

    const { data, error } = await sb
      .from('funding_cases')
      .select('id,case_reference,status,client_id,project_id,user_id')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Funding case not found or not owned by the signed-in user');
    return data;
  }

  function lockSubmittedForm(form, status) {
    const editable = !status || status === 'draft' || status === 'additional_information_required';
    if (editable || !form) return false;
    form.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = true; });
    form.querySelectorAll('button').forEach(btn => {
      if (!btn.hasAttribute('data-export')) btn.disabled = true;
    });
    return true;
  }

  async function syncSubmission(sb, fundingCase, requirementCode, record) {
    if (!sb || !fundingCase?.id || !requirementCode || !record?.id) return null;

    const { data: requirement, error: requirementError } = await sb
      .from('funding_file_requirements')
      .select('id')
      .eq('code', requirementCode)
      .eq('is_active', true)
      .maybeSingle();

    if (requirementError) throw requirementError;
    if (!requirement) throw new Error('Funding requirement not found: ' + requirementCode);

    const payload = {
      case_id: fundingCase.id,
      requirement_id: requirement.id,
      source_record_id: record.id,
      status: record.status || 'draft',
      submitted_at: record.submitted_at || null
    };

    const { data, error } = await sb
      .from('funding_case_submissions')
      .upsert(payload, { onConflict: 'case_id,requirement_id' })
      .select('id,case_id,requirement_id,source_record_id,status,submitted_at,updated_at')
      .single();

    if (error) throw error;
    return data;
  }

  window.BondsFundingCaseContext = {
    getCaseId: readCaseId,
    withCase,
    resolve,
    lockSubmittedForm,
    syncSubmission
  };
}());
