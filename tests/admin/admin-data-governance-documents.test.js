const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Data governance and document center',()=>{
 test('schema covers lineage retention PII privacy exports merge reviews audit anchors and document versions',()=>{
  const sql=read('supabase/migrations/20261013003000_admin_data_governance_documents.sql');
  for(const n of ['admin_data_lineage','admin_retention_policies','admin_pii_field_policies','admin_privacy_requests','admin_data_exports','admin_user_merge_requests','admin_audit_integrity_anchors','admin_documents','admin_document_versions','admin_document_permissions'])expect(sql).toContain('public.'+n);
  expect(sql).toContain('idx_admin_data_lineage_unique');
 });
 test('duplicate detection masks PII without sensitive permission',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('function maskEmail');expect(api).toContain('function maskPhone');
  expect(api).toContain("access.permissions.includes('users.read_sensitive')");
  expect(api).toContain("piiMode:canReadSensitive?'unmasked':'masked'");
 });
 test('user merge is dry-run and approval gated rather than destructive',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function createUserMergeDryRun');
  expect(api).toContain('destructiveExecution:false');
  expect(api).toContain('requiresApproval:true');
  expect(api).not.toContain('async function executeUserMerge');
 });
 test('document center supports metadata versioning and expiry',()=>{
  const api=read('api/admin.js'),page=read('admin/data-governance.html'),dash=read('admin/dashboard.html');
  expect(api).toContain('async function registerAdminDocument');expect(api).toContain('async function addAdminDocumentVersion');
  expect(page).toContain('Data Governance & Document Center');expect(page).toContain('Merge Users — Dry Run');expect(page).toContain('BondsAdminCommon.escapeHtml');
  expect(dash).toContain('/admin/data-governance.html?embed=1');
 });
});