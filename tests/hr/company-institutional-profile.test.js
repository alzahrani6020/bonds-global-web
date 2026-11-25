const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
describe('HR institutional company profile',()=>{
 const sql=file('supabase/migrations/20261125190000_hr_company_profiles.sql');
 const js=file('my-bonds/crm/company-hr-company-profile.js');
 test('additive, owner-scoped, RLS protected and private branding',()=>{
  expect(sql).toMatch(/create table if not exists public\.hr_company_profiles/);
  expect(sql).toMatch(/crm_workspace_id uuid primary key references public\.crm_app_workspaces\(id\) on delete restrict/);
  expect(sql).toMatch(/alter table public\.hr_company_profiles enable row level security/);
  expect(sql).toMatch(/owner_user_id=\(select auth\.uid\(\)\)/);
  expect(sql).toMatch(/'hr-company-branding','hr-company-branding',false,2097152/);
  expect(sql).not.toMatch(/\b(drop table|truncate|disable row level security|delete from)\b/i);
 });
 test('editor is available in both languages, with protected file type',()=>{
  for(const lang of ['','en/']){
   const html=file(lang+'my-bonds/crm/index.html');
   expect(html).toContain('id="hr-company-profile"');
   expect(html).toContain('id="hr-company-profile-form"');
   expect(html).toContain('company-hr-company-profile.js?v=1');
   expect(html).toContain('id="hr-company-logo-file" accept="image/png,image/jpeg,image/webp"');
   expect(html).toContain('name="vat_number"');
   expect(html).toContain('name="business_activity"');
  }
 });
 test('email invitation remains primary and duplicate active access is blocked',()=>{
  const self=file('my-bonds/crm/company-hr-self-service.js');
  const ar=file('my-bonds/crm/index.html'),english=file('en/my-bonds/crm/index.html');
  expect(ar.indexOf('id="hr-invite-form"')).toBeLessThan(ar.indexOf('id="hr-member-form"'));
  expect(english.indexOf('id="hr-invite-form"')).toBeLessThan(english.indexOf('id="hr-member-form"'));
  expect(self).toContain('Employee already has active access; no invitation needed');
  expect(self).toContain('Membership active — prior invite not needed');
  expect(self).toContain("or('user_id.eq.'+userId+',employee_id.eq.'+employeeId)");
 });
 test('client verifies readback, logo type and organization before saving',()=>{
  expect(js).toContain(".eq('crm_workspace_id',wid).single()");
  expect(js).toContain("workspace.owner_user_id!==user.id");
  expect(js).toContain('file.size>2097152');
  expect(js).toContain("upsert(data,{onConflict:'crm_workspace_id'})");
  expect(js).toContain("createSignedUrl(row.logo_path,120)");
 });
});
