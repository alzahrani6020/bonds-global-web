/** @jest-environment node */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('Customer CRM installable workspace integrity',()=>{
 const html=read('my-bonds/crm/index.html'),js=read('my-bonds/crm/crm-app.js');
 const manifest=JSON.parse(read('my-bonds/crm/crm-manifest.webmanifest'));
 const sql=read('supabase/migrations/20261115020000_crm_client_app_isolated_workspaces.sql');
 test('all locally linked app assets exist and manifest is installable',()=>{
  for(const asset of ['crm-app.js','crm-app.css','crm-manifest.webmanifest'])
    expect(fs.existsSync(path.join(root,'my-bonds/crm',asset))).toBe(true);
  expect(html).toMatch(/\/my-bonds\/crm\/crm-app\.js\?v=\d+/);
  expect(manifest.start_url).toMatch(/^\/my-bonds\/crm\//);
  expect(manifest.display).toBe('standalone');
  for(const icon of manifest.icons)expect(fs.existsSync(path.join(root,icon.src.replace(/^\//,'')))).toBe(true);
 });
 test('multiple owned workspaces are selectable and can be created from either locale',()=>{
  const en=read('en/my-bonds/crm/index.html');
  for(const page of [html,en]){
   expect(page).toContain('id="workspace-create-open"');
   expect(page).toContain('id="workspace-create-cancel"');
   expect(page).toContain('id="workspace-select"');
  }
  expect(js).toContain("$('workspace-switch-label').hidden=spaces.length===0");
  expect(js).toContain("$('workspace-create-open').addEventListener('click'");
  expect(js).toContain("$('workspace-create-cancel').addEventListener('click'");
  expect(js).toContain("$('workspace-select').value=w.id");
  expect(js).toContain("availableWorkspaces.push(workspace)");
  const multi=read('supabase/migrations/20261115193300_crm_multiple_owner_workspaces.sql');
  expect(multi).toContain('drop constraint if exists crm_app_workspaces_owner_user_id_key');
  expect(multi).not.toMatch(/\\b(delete|truncate|drop table)\\b/i);
 });
 test('browser uses signed-in Supabase session and workspace-scoped queries',()=>{
  expect(js).toContain('window.BondsAuth.ensureEnv()');
  expect(js).toContain('sb.auth.getUser()');
  expect(js).toContain(".eq('workspace_id',workspace.id)");
  expect(js).not.toMatch(/localStorage\.setItem|sessionStorage\.setItem|caches\.open/);
 });
 test('all seven client tables use RLS and ownership',()=>{
  for(const table of ['crm_app_workspaces','crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success'])
    expect(sql).toContain(table);
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('owner_user_id=(select auth.uid())');
  expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
 });
 test('en/CRM has a real English route and linked data-driven localization',()=>{
  const en=read('en/my-bonds/crm/index.html');
  expect(en).toContain('<html lang="en" dir="ltr">');
  expect(en).toContain('data-section="companies"');
  expect(en).toContain('Companies');
  expect(en).toMatch(/\/my-bonds\/crm\/crm-app\.js\?v=\d+/);
  expect(js).toContain('document.documentElement.lang');
  expect(js).toContain('translations');
 });
 test('not-null enum selects never default to empty and deletions cannot cascade from account',()=>{
  expect(js).toContain("(!reference||required?' required':'')");
  expect(js).toContain("const selected=value==null?(reference?'':");
  const sql=read('supabase/migrations/20261115020000_crm_client_app_isolated_workspaces.sql');
  expect(sql).toContain('owner_user_id uuid not null references auth.users(id) on delete restrict');
  expect(sql).not.toContain('owner_user_id uuid not null references auth.users(id) on delete cascade');
 });

 test('admin overview tolerates only the absent activities table',()=>{
  const api=read('api/admin.js');
  expect(api).toContain("['42P01', 'PGRST205'].includes(activitiesRes.error.code)");
  expect(api).toContain('activitiesUnavailable');
  expect(api).toContain('for (const result of [orgsRes, clientsRes, oppsRes, renewalsRes, successRes, serviceRequestsRes])');
 });
 test('rendering activity KPIs excludes archived tasks and dates use local wall time',()=>{
  expect(js).toContain("!r.deleted_at&&r.status==='open'");
  expect(js).toContain('d.getHours()');
  expect(js).toContain('d.getMinutes()');
  expect(js).not.toContain("new Date(v).toISOString().slice(0,16)");
 });

 test('custom pipeline and stage tables enforce workspace-scoped relationships',()=>{
  const sql=read('supabase/migrations/20261115020000_crm_client_app_isolated_workspaces.sql');
  for(const table of ['crm_app_pipelines','crm_app_pipeline_stages']){
   expect(sql).toContain('create table public.'+table);
   expect(js).toContain("'"+table+"'");
  }
  expect(sql).toContain('crm_app_deal_pipeline_stage_fk');
  expect(sql).toContain('foreign key(workspace_id,pipeline_id,pipeline_stage_id)');
  expect(sql).toContain('references public.crm_app_pipeline_stages(workspace_id,pipeline_id,id)');
  expect(sql).toContain("'crm_app_pipelines','crm_app_pipeline_stages'");
  expect(js).toContain("stage.pipeline_id!==payload.pipeline_id");
  const ar=read('my-bonds/crm/index.html'),en=read('en/my-bonds/crm/index.html');
  expect(ar).toContain('data-section="stages"');
  expect(en).toContain('data-section="stages"');
  expect(js).toContain("key==='is_active'");
 });

 test('client CRM is discoverable via bilingual header and My Bonds, and language routes are linked',()=>{
  const header=read('site-layout.js');
  const ar=read('my-bonds/crm/index.html');
  const en=read('en/my-bonds/crm/index.html');
  expect(header).toContain("href: isEn ? '/en/my-bonds/crm/' : '/my-bonds/crm/'");
  expect(read('my-bonds/index.html')).toContain('href="/my-bonds/crm/"');
  expect(read('en/my-bonds/index.html')).toContain('href="/en/my-bonds/crm/"');
  expect(ar).toContain('href="/en/my-bonds/crm/"');
  expect(en).toContain('href="/my-bonds/crm/"');
 });

 test('commercial scoring is integrated into the tenant CRM without internal admin API access',()=>{
  expect(js).toContain('const scoreContact=record=>commercialScore(');
  expect(js).toContain('const scoreDeal=record=>');
  expect(js).toContain("group==='contacts'||group==='deals'");
  expect(js).toContain("التقييم التجاري");
  expect(js).not.toContain("'/api/admin");
 });
 test('CSV contact import/export is tenant-scoped, bounded and protects spreadsheet cells',()=>{
  const ar=read('my-bonds/crm/index.html');
  const en=read('en/my-bonds/crm/index.html');
  for(const html of [ar,en]){
   expect(html).toContain('id="csv-import"');
   expect(html).toContain('id="csv-export"');
   expect(html).toContain('id="csv-file"');
  }
  expect(js).toContain('function parseCsv(text)');
  expect(js).toContain('function csvCell(value)');
  expect(js).toContain('if(/^\\s*[=+@\\-\\t\\r]/.test(v))');
  expect(js).toContain('if(records.length>100)');
  expect(js).toContain("sb.from('crm_app_contacts').insert(payload)");
  expect(js).toContain(".eq('workspace_id',workspace.id)");
  expect(sql).toContain('create unique index crm_app_contacts_workspace_identity_unique');
  expect(sql).toContain('on public.crm_app_contacts(workspace_id,lower(btrim(name)),lower(btrim(email)))');
 });
 test('blank deal currency does not violate the NOT NULL database constraint',()=>{
  expect(js).toContain("if(group==='deals' && !payload.currency)");
  expect(js).toContain('delete payload.currency');
  expect(sql).toContain("currency text not null default 'SAR'");
 });

 test('PWA manifests install into language-matched workspace routes',()=>{
  const en=read('en/my-bonds/crm/index.html');
  const enManifest=JSON.parse(read('en/my-bonds/crm/crm-manifest.webmanifest'));
  expect(en).toContain('href="/en/my-bonds/crm/crm-manifest.webmanifest"');
  expect(enManifest.start_url).toMatch(/^\/en\/my-bonds\/crm\//);
  expect(enManifest.scope).toBe('/en/my-bonds/crm/');
  expect(enManifest.lang).toBe('en');
  expect(manifest.scope).toBe('/my-bonds/crm/');
 });

 test('deal stage selector only accepts active stages from its selected pipeline',()=>{
  expect(js).toContain('function updatePipelineStageOptions()');
  expect(js).toContain('item.pipeline_id===pipeline.value&&item.is_active');
  expect(js).toContain("if(event.target.name==='pipeline_id')updatePipelineStageOptions()");
  expect(js).toContain('if(stages.some(item=>item.id===selected))stage.value=selected');
 });

});
