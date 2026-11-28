'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'letterhead.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.css'), 'utf8');
const core = fs.readFileSync(path.join(root, 'components/letterhead-correspondence.js'), 'utf8');

describe('Correspondence institutional UI integration', () => {
  test('preserves governed editor and loads layout assets only once', () => {
    expect(page.match(/components\/correspondence-workspace-ui\.css\?v=2/g)).toHaveLength(1);
    expect(page.match(/components\/correspondence-workspace-ui\.js\?v=3/g)).toHaveLength(1);
    expect(page).toContain('id="letterhead-toolbar"');
    expect(page).toContain('id="pages-container"');
    expect(page).toContain('/components/letterhead-correspondence.js?v=6');
  });

  test('only changes correspondence-mode presentation and reuses existing actions', () => {
    expect(script).toContain("get('workspace') !== 'correspondence'");
    expect(script).toContain("document.body.classList.add('bx-correspondence')");
    expect(script).toContain("editor.append(toolbar, documentArea)");
    expect(script).toContain('documentArea.append(pages)');
    ['corr-new','corr-save','corr-save-submit','corr-command-open','corr-command-search-btn','corr-details-toggle'].forEach(id => {
      expect(script).toContain("'" + id + "'");
      expect(core).toContain("'" + id + "'");
    });
    expect(script).not.toMatch(/\.from\(|fetch\(|\.insert\(|\.upsert\(|\.update\(/);
  });

  test('does not replace stored document content or fabricate message counts', () => {
    expect(script).not.toMatch(/innerHTML\s*=|localStorage\.|BG-2026-0148|3,123|2,846/);
    expect(styles).toContain('@media print');
    expect(styles).toContain('@media(max-width:780px)');
    expect(styles).toContain('.bx-document-area .sheet');
    expect(styles).toContain('.bx-editor #letterhead-toolbar .toolbar-row{display:flex');
    expect(styles).toContain('.bx-editor.bx-hide-tools #letterhead-toolbar .toolbar-row{display:none}');
    expect(script).toContain("action.style.display === 'none'");
    expect(script).toContain("activateExisting('corr-submit')");
    expect(script).toContain("window.toggleInbox");
  });
});


describe('Denied owner-only correspondence keeps tenant campaign access separately governed', () => {
  const vm = require('node:vm');
  const begin = core.indexOf('  async function offerTenantCampaignAccess(screen) {');
  const end = core.indexOf('  async function initialize() {', begin);
  function build({session, response}) {
    expect(begin).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(begin);
    const created = [];
    let calls = 0;
    const document = {
      createElement(tag) {
        const element = {tag, textContent:'', href:'', style:{cssText:''}};
        created.push(element);
        return element;
      }
    };
    const screen = {children:[],append(child){this.children.push(child)}};
    const fetch = async (url, options) => {
      calls += 1;
      expect(url).toBe('/api/campaigns?mine=1');
      expect(options.method).toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer test-token');
      return response;
    };
    const context = {
      window:{BondsAuth:{getSession:async()=>({data:{session}})}},
      document,fetch,isEn:false
    };
    vm.runInNewContext(core.slice(begin,end)+'; this.offerTenantCampaignAccess=offerTenantCampaignAccess;',context);
    return {call:()=>context.offerTenantCampaignAccess(screen),screen,created,getCalls:()=>calls};
  }
  test('owner-only ledger remains protected while verified tenant campaigns are linked',async()=>{
    const a='94aaa3ab-ff11-4730-976c-02e4347d9636';
    const b='8a74eb8c-64f0-4b2c-93a2-dc9a6b88ca24';
    const h=build({session:{access_token:'test-token'},response:{
      ok:true,json:async()=>({workspaces:[
        {id:a,name:'Company A',role:'owner'},
        {id:b,name:'Company B',role:'editor'},
        {id:'bad-id',name:'Forged',role:'owner'},
        {id:'11111111-1111-4111-8111-111111111111',name:'Unpermitted',role:'viewer'}
      ]})
    }});
    await h.call();
    const links=h.screen.children.filter(el=>el.tag==='a');
    expect(links.map(el=>el.href)).toEqual([
      '/correspondence-campaigns.html?workspace_id='+a,
      '/correspondence-campaigns.html?workspace_id='+b
    ]);
    expect(h.getCalls()).toBe(1);
    expect(core).toContain("if (error.status === 403) await offerTenantCampaignAccess(screen)");
    expect(core).not.toContain('window.location.assign(authorization');
  });
  test('does not reveal company links without authentication or positive authorization',async()=>{
    const anonymous=build({session:null,response:{ok:true,json:async()=>({workspaces:[]})}});
    await anonymous.call();
    expect(anonymous.screen.children).toHaveLength(0);
    expect(anonymous.getCalls()).toBe(0);
    const forbidden=build({session:{access_token:'test-token'},response:{ok:false,status:403}});
    await forbidden.call();
    expect(forbidden.screen.children).toHaveLength(0);
    const none=build({session:{access_token:'test-token'},response:{
      ok:true,json:async()=>({workspaces:[{id:'94aaa3ab-ff11-4730-976c-02e4347d9636',role:'viewer'}]})
    }});
    await none.call();
    expect(none.screen.children).toHaveLength(0);
  });
});
