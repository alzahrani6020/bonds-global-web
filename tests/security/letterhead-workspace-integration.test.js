const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Letterhead governed workspace integration', () => {
  test('workspace entry never reuses a stale last-document fallback', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('function hasWorkspaceContext()');
    expect(client).toContain("if (hasWorkspaceContext()) return ''");
    expect(client).toContain("localStorage.getItem('bonds_letterhead_current_document')");
  });

  test('language switching preserves document and workspace query context', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('const params = new URLSearchParams(location.search)');
    expect(client).toContain("params.set('document', id)");
    expect(client).toContain("location.href = base + (params.toString() ? '?' + params.toString() : '')");
  });

  test('locked correspondence blocks all legacy mutation surfaces', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('function installGovernedMutationGuards()');
    for (const name of [
      'insertDateTime','insertSubject','applyTemplate','insertRuler','addNewPage','clearAll',
      'alignText','toggleList','indentText','outdentText','toggleBold','toggleItalic',
      'toggleUnderline','setColor','findReplaceText','changeFont'
    ]) {
      expect(client).toContain("'" + name + "'");
    }
    expect(client).toContain('function prepareEditableAction()');
    expect(client).toContain('setLegacyEditorControlsDisabled(!canEditCurrent() && !canStartRejectedRevision())');
    expect(client).toContain('imageInput.disabled = !!disabled');
    expect(client).toContain('importInput.disabled = !!disabled');
  });

  test('locked local exports reload the governed server version', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('async function restoreCanonicalLockedDocument()');
    expect(client).toContain('await loadDocument(state.document.id)');
    expect(client).toContain('window.exportWord = async function ()');
    expect(client).toContain('await restoreCanonicalLockedDocument()');
    expect(client).toContain('window.exportPDF = async function ()');
    expect(client).toContain('state.latestVersion = {');
  });

  test('issuance and final PDF are separate governed permissions and actions', () => {
    const client = read('components/letterhead-correspondence.js');
    const transitionStart = client.indexOf('async function transition(target');
    const markStart = client.indexOf('async function mark(', transitionStart);
    const transitionBody = client.slice(transitionStart, markStart);
    expect(transitionBody).not.toContain('await persistIssuedPdfArtifact()');
    expect(client).toContain("can('finalize_pdf')");
    expect(client).toContain("visible.add('corr-finalize-pdf')");
    expect(client).toContain("visible.add('corr-send')");
  });

  test('server validates and filters workspace context', () => {
    const api = read('lib/api/correspondence.js');
    expect(api).toContain('function cleanWorkspaceContext(input)');
    expect(api).toContain('async function validateWorkspaceContext(sb, input, user, role');
    expect(api).toContain("sb.from('service_requests')");
    expect(api).toContain("sb.from('funding_cases')");
    expect(api).toContain("sb.from('advisory_clients')");
    expect(api).toContain("['user_projects', 'id,user_id,company_id']");
    expect(api).toContain("deny('project_id')");
    expect(api).toContain("deny('client_id')");
    expect(api).toContain("sb.from('service_catalog').select('code').eq('code', ctx.service)");
    expect(api).toContain("query.contains('workspace_context', { [key]: value })");
    expect(api).toContain('function workspaceContextMatches(context, filters)');
    expect(api).toContain("sb.rpc('get_correspondence_summary_v2'");
    expect(api).toContain("sb.rpc('get_correspondence_my_work_v2'");
  });

  test('My BONDS, service workspace and assistant registry expose correspondence as a first-class workspace', () => {
    const myAr = read('my-bonds/index.html');
    const myEn = read('en/my-bonds/index.html');
    const service = read('components/service-request.js');
    const nav = JSON.parse(read('lib/assistant/navigation-registry.json'));
    const tools = read('lib/assistant/deterministic-tools.js');

    expect(myAr).toContain('مساحة المراسلات');
    expect(myAr).toContain('../letterhead.html');
    expect(myEn).toContain('Correspondence Workspace');
    expect(myEn).toContain('../../en/letterhead.html');

    expect(service).toContain('function correspondenceWorkspaceHref()');
    expect(service).toContain("next.set('return_to',location.pathname+location.search)");
    expect(service).toContain('renderCorrespondenceWorkspaceLink()');
    expect(service).toContain("lang==='ar'?'فتح المراسلات':'Open correspondence'");

    expect(nav.destinations.correspondence_workspace).toEqual({
      routes: { ar: '/letterhead.html', en: '/en/letterhead.html' },
      kind: 'workspace',
      risk: 'low',
      auth_required: true
    });
    expect(tools).toContain("target: 'correspondence_workspace'");
    expect(tools).toContain("correspondence_workspace: { ar: 'مساحة المراسلات', en: 'Correspondence workspace' }");
  });

  test('workspace inbox, search, summary and tasks are scoped and localized', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("page_size: state.inboxPageSize");
    expect(client).toContain("query: { ...workspaceQuery(), q, page: 1, page_size: 10 }");
    expect(client).toContain("api('summary', { query: workspaceQuery() })");
    expect(client).toContain('page_size: state.workPageSize');
    expect(client).toContain('corr-work-pagination');
    expect(client).toContain('statusLabel(doc.status)');
  });

  test('workspace return action is explicit and preserves workspace context', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('function workspaceReturnUrl()');
    expect(client).toContain("'corr-workspace-return'");
    expect(client).toContain("isEn ? 'Back to workspace' : 'العودة لمساحة العمل'");
  });

  test('editable correspondence restores typing and paste state after load and page resets', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("d.contentEditable = isEditable ? 'true' : 'false'");
    expect(client).toContain("d.setAttribute('aria-readonly', isEditable ? 'false' : 'true')");
    expect(client).toContain("doc.contentEditable = canEditCurrent() ? 'true' : 'false'");
    expect(client).toContain("doc.setAttribute('aria-readonly', canEditCurrent() ? 'false' : 'true')");
    expect(client).toContain('setEditorEditable(canEditCurrent())');
  });

  test('undo redo and legacy write toggle preserve governed ownership checks', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('window.undoDoc = function ()');
    expect(client).toContain('window.redoDoc = function ()');
    expect(client).toContain('if (!prepareEditableAction()) return toast');
    expect(client).toContain("if (!prepareEditableAction()) return toast('⚠️ ' + (isEn ? 'This document is locked or not owned by the current user'");
    expect(client).toContain("if (!canEditCurrent()) throw new Error(isEn ? 'This document is locked or not owned by the current user'");
    expect(client).toContain('if (!canEditCurrent()) return;');
  });

  test('governed mode prevents stale local content and phantom drafts', () => {
    const client = read('components/letterhead-correspondence.js');
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    expect(client).toContain('window.BONDS_GOVERNED_CORRESPONDENCE = true');
    expect(client).toContain("if (!state.document && !hasMeaningfulDraft()) return");
    expect(client).toContain("setPages([''], { markSaved: false })");
    expect(client).toContain('if (options.markSaved) state.lastSavedSnapshot = persistedSnapshot()');
    expect(client).toContain("setPages(JSON.parse(prev), { markSaved: false })");
    expect(ar).toContain('if (!window.BONDS_GOVERNED_CORRESPONDENCE)');
    expect(en).toContain('if (!window.BONDS_GOVERNED_CORRESPONDENCE)');
  });

  test('official PDF and inbox use governed artifact and real pagination', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("api('artifact-download-url'");
    expect(client).toContain('state.inboxPageSize');
    expect(client).toContain('corr-inbox-pagination');
    expect(client).toContain('state.inboxTotal');
  });

  test('metadata-only edits are tracked as unsaved and explicit new correspondence is available', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('function persistedSnapshot()');
    expect(client).toContain("recipient_email: document.getElementById('corr-recipient-email')");
    expect(client).toContain("addButton(actions, 'corr-new'");
    expect(client).toContain('function startNewCorrespondence()');
    expect(client).toContain("localStorage.removeItem('bonds_letterhead_current_document')");
  });

  test('external send requires a real recipient while internal correspondence may use governed admin routing', () => {
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');
    expect(api).toContain("Recipient email is required for non-internal correspondence");
    expect(client).toContain("doc?.direction === 'internal' || !!doc?.recipient_email");
    expect(client).toContain("status === 'sent' || (status === 'issued' && doc?.direction === 'internal')");
  });

  test('rejected correspondence offers a safe editable revision copy without mutating the rejected record', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("addButton(actions, 'corr-revise-copy'");
    expect(client).toContain('function startRejectedRevision()');
    expect(client).toContain("state.document.status !== 'rejected'");
    expect(client).toContain("url.searchParams.delete('document')");
    expect(client).toContain("setPages(sourcePages.length ? sourcePages : [''], { markSaved: false })");
    expect(client).toContain('setEditorEditable(true)');
    expect(client).toContain('setLegacyEditorControlsDisabled(false)');
    expect(client).toContain("status === 'rejected' && (isOwner() || isAdmin())");
  });


  test('server-authoritative ownership controls rejected revision availability', () => {
    const client = read('components/letterhead-correspondence.js');
    const api = read('lib/api/correspondence.js');
    expect(client).toContain('serverIsOwner: null');
    expect(client).toContain("typeof state.serverIsOwner === 'boolean'");
    expect(client).toContain("state.serverIsOwner = typeof result.is_owner === 'boolean' ? result.is_owner : null");
    expect(api).toContain('is_owner: doc.owner_user_id === user.id');
  });


  test('rejected owner toolbar actions create a safe revision instead of staying frozen', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('function canStartRejectedRevision()');
    expect(client).toContain('function prepareEditableAction()');
    expect(client).toContain('startRejectedRevision();');
    expect(client).toContain('setLegacyEditorControlsDisabled(!canEditCurrent() && !canStartRejectedRevision())');
    expect(client).toContain('if (!prepareEditableAction())');
  });

  test('workspace context survives correspondence navigation and document reloads', () => {
    const client = read('components/letterhead-correspondence.js');
    const api = read('lib/api/correspondence.js');
    const serviceRequest = read('components/service-request.js');
    const myBonds = read('my-bonds/index.html');
    const myBondsEn = read('en/my-bonds/index.html');
    expect(client).toContain("state.document?.workspace_context");
    expect(client).toContain("'return_to'");
    expect(client).toContain("ctx.workspace = 'correspondence'");
    expect(api).toContain("'return_to'");
    expect(api).toContain('Invalid workspace return path');
    expect(serviceRequest).toContain("['service','company_id','project_id','client_id','funding_case_id','request_id']");
    expect(myBonds).toContain('workspace=correspondence&return_to=%2Fmy-bonds%2F');
    expect(myBondsEn).toContain('workspace=correspondence&return_to=%2Fen%2Fmy-bonds%2F');
  });


  test('initial rejected owner document opens as an editable safe revision automatically', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('if (canStartRejectedRevision()) startRejectedRevision();');
    expect(client).toContain("setEditorEditable(true)");
    expect(client).toContain("setLegacyEditorControlsDisabled(false)");
  });

  test('revision copy retains workspace context after detaching from rejected source document', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain('workspaceContext: null');
    expect(client).toContain("state.workspaceContext = source.workspace_context");
    expect(client).toContain("state.workspaceContext && typeof state.workspaceContext === 'object'");
    expect(client).toContain("state.workspaceContext = state.document?.workspace_context");
  });


  test('correspondence uses independent outgoing incoming and archive registers', () => {
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');
    expect(api).toContain("next_correspondence_register");
    expect(api).toContain("p_kind: kind");
    expect(api).toContain("updates.incoming_number = incomingNumber");
    expect(api).toContain("updates.outgoing_number = reference");
    expect(api).toContain("updates.archive_number = await nextRegisterNumber(sb, 'archive')");
    expect(client).toContain("corr-outgoing-number");
    expect(client).toContain("corr-incoming-number");
    expect(client).toContain("corr-archive-number");
  });

  test('rejected revision is linked to its source correspondence', () => {
    const api = read('lib/api/correspondence.js');
    const client = read('components/letterhead-correspondence.js');
    expect(api).toContain("related_document_id: cleanText(body.related_document_id, 64)");
    expect(api).toContain("Related correspondence is not accessible to the current user");
    expect(client).toContain("state.relatedDocumentId = source.id");
    expect(client).toContain("related_document_id: state.relatedDocumentId || null");
  });


  test('official outgoing issues require stamp and expose governed issuance ledger', () => {
    const api = read('lib/api/correspondence.js');
    expect(api).toContain("row.requires_stamp = row.direction === 'outgoing'");
    expect(api).toContain("Outgoing official correspondence requires the Bonds administrative stamp before issuance");
    expect(api).toContain("action === 'issue-ledger'");
    expect(api).toContain("correspondence_issues");
    expect(api).toContain("action === 'revoke-issue'");
  });

  test('official letter shows separate document and website QR codes', () => {
    const client = read('components/letterhead-correspondence.js');
    const ar = read('letterhead.html');
    const en = read('en/letterhead.html');
    expect(client).toContain("footer-document-qr");
    expect(client).toContain("footer-site-qr");
    expect(client).not.toContain("التوقيع مسجل في سجل تدقيق بوندز");
    expect(ar).toContain("تحقق من الخطاب");
    expect(ar).toContain("موقع بوندز");
    expect(en).toContain("Verify this letter");
    expect(en).toContain("Bonds website");
  });

  test('signature and stamp are rendered as official artifacts with signer identity', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("corr-signer-name");
    expect(client).toContain("corr-signer-title");
    expect(client).toContain("signer_name:");
    expect(client).toContain("signer_title:");
    expect(client).toContain("الختم الرسمي");
    expect(client).toContain("التوقيع الرسمي");
  });

  test('verification page is an outgoing register with issue state version and official PDF', () => {
    const page = read('verify-document.html');
    expect(page).toContain("سجل صادر بوندز");
    expect(page).toContain('id="issue-version"');
    expect(page).toContain('id="issue-state"');
    expect(page).toContain('id="official-pdf"');
    expect(page).toContain('id="verify-count"');
  });

  test('issued correspondence can be reissued or revoked without mutating prior issue', () => {
    const client = read('components/letterhead-correspondence.js');
    expect(client).toContain("function startOfficialReissue()");
    expect(client).toContain("state.relatedDocumentId = source.id");
    expect(client).toContain("corr-reissue");
    expect(client).toContain("corr-revoke-issue");
    const migration = read('supabase/migrations/20261112132301_correspondence_issuance_ledger.sql');
    expect(migration).toContain("supersedes_issue_id");
    expect(migration).toContain("state = 'superseded'");
  });

});
