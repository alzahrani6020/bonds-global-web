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
 test('client verifies readback, logo type and organization before saving',()=>{
  expect(js).toContain(".eq('crm_workspace_id',wid).single()");
  expect(js).toContain("workspace.owner_user_id!==user.id");
  expect(js).toContain('file.size>2097152');
  expect(js).toContain("upsert(data,{onConflict:'crm_workspace_id'})");
  expect(js).toContain("createSignedUrl(row.logo_path,120)");
 });
});
