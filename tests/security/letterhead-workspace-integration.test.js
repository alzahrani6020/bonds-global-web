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
    expect(client).toContain('if (!canEditCurrent())');
    expect(client).toContain('setLegacyEditorControlsDisabled(!canEditCurrent())');
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
    expect(api).toContain('async function validateWorkspaceContext(sb, input)');
    expect(api).toContain("['request_id','service_requests']");
    expect(api).toContain("['funding_case_id','funding_cases']");
    expect(api).toContain("['client_id','advisory_clients']");
    expect(api).toContain("['user_projects','bonds_projects','projects','advisory_projects','city_projects']");
    expect(api).toContain("sb.from('service_catalog').select('code').eq('code', ctx.service)");
    expect(api).toContain("query.contains('workspace_context', { [key]: value })");
    expect(api).toContain('function workspaceContextMatches(context, filters)');
    expect(api).toContain('myWorkWorkspaceFilters');
    expect(api).toContain('summaryWorkspaceFilters');
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
    expect(client).toContain("api('list', { query: workspaceQuery() })");
    expect(client).toContain("query: { ...workspaceQuery(), q, page: 1, page_size: 10 }");
    expect(client).toContain("api('summary', { query: workspaceQuery() })");
    expect(client).toContain("api('my-work', { query: workspaceQuery() })");
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
    expect(client).toContain('if (!canEditCurrent()) return toast');
    expect(client).toContain('window.undoDoc = function ()');
    expect(client).toContain('window.redoDoc = function ()');
    expect(client).toContain("if (!canEditCurrent()) return toast('⚠️ ' + (isEn ? 'This document is locked or not owned by the current user'");
    expect(client).toContain("if (!canEditCurrent()) throw new Error(isEn ? 'This document is locked or not owned by the current user'");
    expect(client).toContain('if (!canEditCurrent()) return;');
  });

});
