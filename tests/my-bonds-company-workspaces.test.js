const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'components/my-bonds-company-workspaces.js'), 'utf8');
const arabic = fs.readFileSync(path.join(root, 'my-bonds/index.html'), 'utf8');
const english = fs.readFileSync(path.join(root, 'en/my-bonds/index.html'), 'utf8');

describe('My Bonds company workspaces', () => {
  test.each([[arabic, 'مساحات عمل الشركات'], [english, 'Company Workspaces']])('renders an authenticated workspace section', (html, label) => {
    expect(html).toContain('id="companyWorkspacesSection" hidden');
    expect(html).toContain('id="companyWorkspacesList"');
    expect(html).toContain(label);
    expect(html).toContain('/components/my-bonds-company-workspaces.js?v=1');
  });
  test('reads only RLS-authorized workspaces from the connected session', () => {
    expect(script).toContain("window.BondsAuth.getUser()");
    expect(script).toContain("window.BondsAuth.getSupabase()");
    expect(script).toContain(".from('crm_app_workspaces')");
    expect(script).toContain(".select('id,name')");
    expect(script).not.toMatch(/service_role|\.insert\(|\.upsert\(|\.update\(|owner_user_id\s*:/);
  });
  test('does not advertise unfinished HR as operational or expose unauthorized workspace names', () => {
    expect(script).toContain("root.hidden = true");
    expect(script).toContain("words.pending");
    expect(script).toContain("textContent = workspace.name");
    expect(script).not.toContain('innerHTML');
  });
});
