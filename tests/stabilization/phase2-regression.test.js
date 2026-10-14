/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('stabilization phase 2', () => {
  test('public header uses grouped information architecture and safe bilingual V3 routing', () => {
    const layout = read('site-layout.js');
    expect(layout).toContain("tools: isEn ? 'Tools' : 'الأدوات'");
    expect(layout).toContain("aboutGovernance: isEn ? 'About' : 'عن بوندز'");
    expect(layout).toContain("heading: { ar: labels.advisoryGroup");
    expect(layout).toContain("heading: { ar: labels.fundingGroup");
    expect(layout).toContain("heading: { ar: labels.intelligenceGroup");
    expect(layout).toContain("return '/en/v3/?from=' + encodeURIComponent");
    expect(layout).toContain("Data Sources & Methodology");
  });

  test('English intelligence language destination exists', () => {
    const hub = read('en/v3/index.html');
    expect(hub).toContain('Economic Intelligence');
    expect(hub).toContain('/en/data-methodology.html');
    expect(hub).toContain('/v3/city-intelligence');
  });

  test('observed vs modeled data is explicit and inference is opt-in', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain('inferMissing: options.inferMissing === true');
    expect(pipeline).not.toContain('inferMissing: options.inferMissing !== false');
  });

  test('city evidence exposes freshness and stale status', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain('freshnessSlaDays');
    expect(api).toContain('freshness_sla_days: slaDays');
    expect(api).toContain("freshness_status: observationAgeDays == null ? 'unknown' : (stale ? 'stale' : 'fresh')");
    expect(api).toContain("evidence_status: verified ? (stale ? 'stale' : 'verified')");
    expect(api).toContain('staleCount: evidence.filter');
  });

  test('data methodology pages exist in Arabic and English', () => {
    const ar = read('data-methodology.html');
    const en = read('en/data-methodology.html');
    expect(ar).toContain('مصادر ومنهجية البيانات');
    expect(ar).toContain('مثبت Verified');
    expect(en).toContain('Data Sources & Methodology');
    expect(en).toContain('Modeled');
  });

  test('admin sidebar is reorganized into six operational domains', () => {
    const dashboard = read('admin/dashboard.html');
    for (const label of ['نظرة عامة','العملاء والأعمال','المالية','الذكاء والبيانات','التشغيل','الأمن والحوكمة']) {
      expect(dashboard).toContain("label: '" + label + "'");
    }
    expect(dashboard).toContain('/admin/data-coverage.html?embed=1');
    expect(dashboard).toContain('reorganizeAdminSidebar();');
  });

  test('admin data coverage matrix uses catalog and evidence APIs', () => {
    const coverage = read('admin/data-coverage.html');
    expect(coverage).toContain("/catalog/countries");
    expect(coverage).toContain("/catalog/cities?country=");
    expect(coverage).toContain("/evidence?year=latest");
    expect(coverage).toContain('مصفوفة تغطية البيانات');
  });

  test('health endpoint uses repository Supabase factory and keeps Native readiness separate', () => {
    const health = read('api/health.js');
    const readiness = read('api/readiness.js');
    expect(health).toContain("const getSupabase = require('../lib/api/supabase')");
    expect(health).toContain('const supabase = getSupabase()');
    expect(health).toContain("return res.status(coreHealthy ? 200 : 503)");
    expect(health).toContain("status: coreHealthy ? 'ok' : 'unhealthy'");
    expect(health).toContain("native: 'not_checked'");
    expect(health).toContain("endpoint: '/api/readiness'");
    expect(health).not.toContain("getInferenceRouter().health()");
    expect(readiness).toContain("getInferenceRouter().health()");
    expect(readiness).toContain("return res.status(ready ? 200 : 503)");
    expect(health).not.toContain("const { createClient } = require('../lib/api/supabase')");
  });
});
