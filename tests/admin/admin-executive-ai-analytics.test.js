const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Executive analytics and AI operations',()=>{
 test('schema stores AI telemetry prompt versions kill switches and metric snapshots',()=>{
  const sql=read('supabase/migrations/20261013000000_admin_executive_ai_analytics.sql');
  for(const n of ['admin_ai_operation_events','admin_ai_prompt_versions','admin_ai_kill_switches','admin_metric_snapshots'])expect(sql).toContain('public.'+n);
 });
 test('executive analytics computes requested business metrics from platform data',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function getExecutiveAnalyticsV2');
  for(const k of ['mrr','arr','arpu','conversionPct','churnPct','pipelineValue','weightedPipeline','renewalRisk','customerHealth'])expect(api).toContain(k);
  expect(api).toContain('cohorts');
  expect(api).toContain('funnel');
 });
 test('AI operations exposes usage cost latency failures model and controls',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('costUsd');expect(api).toContain('p95LatencyMs');expect(api).toContain('byModel');expect(api).toContain('byFeature');
  expect(api).toContain('async function setAiKillSwitch');expect(api).toContain('async function createAiPromptVersion');
  expect(api).toContain("requireAdminPermission(req, sb, 'ai.operations.manage')");
 });
 test('workspace labels missing AI telemetry as unknown rather than fabricating it',()=>{
  const page=read('admin/executive-ai-analytics.html'),dash=read('admin/dashboard.html'),i18n=read('admin/admin-i18n.js');
  expect(i18n).toContain('غير معروف — لا توجد بيانات تشغيل للذكاء الاصطناعي بعد');
  expect(i18n).toContain('UNKNOWN — no AI telemetry yet');
  expect(page).toContain("I.t('unknownNoTelemetry')");
  expect(page).toContain('BondsAdminCommon.escapeHtml');
  expect(page).toContain("typeof r.json!=='function'");
  expect(dash).toContain('/admin/executive-ai-analytics.html?embed=1');
 });
});