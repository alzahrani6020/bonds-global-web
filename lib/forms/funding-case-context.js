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

  window.BondsFundingCaseContext = {
    getCaseId: readCaseId,
    withCase,
    resolve
  };
}());
