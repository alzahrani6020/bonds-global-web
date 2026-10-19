/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('business activity information form',()=>{
  test('captures classification, operations, market, commercial, capacity, and growth data',()=>{
    const page=read('client/business-activity.html');
    expect(page).toContain('نموذج معلومات النشاط');
    expect(page).toContain('رمز النشاط / ISIC');
    expect(page).toContain('نموذج العمل');
    expect(page).toContain('نسبة أكبر عميل من الإيرادات');
    expect(page).toContain('نسبة استغلال الطاقة');
    expect(page).toContain('خطط النمو أو التوسع');
    expect(page).toContain("from('client_business_activity_profiles')");
  });

  test('prefills compatible fields from establishment information',()=>{
    const page=read('client/business-activity.html');
    expect(page).toContain("from('client_establishment_profiles')");
    expect(page).toContain("set('primaryActivity',o.main_activity)");
    expect(page).toContain("set('annualRevenue',o.annual_revenue)");
  });

  test('supports Bonds-branded print PDF Excel and Word exports',()=>{
    const page=read('client/business-activity.html');
    for(const f of ['print','pdf','excel','word']) expect(page).toContain(`data-export="${f}"`);
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('Arabic and English counterparts reuse account activity profile and map it to the funding case',()=>{
    const ar=read('client/business-activity.html');
    const en=read('en/client/business-activity.html');
    expect(ar).toContain('lang="ar" dir="rtl"');
    expect(en).toContain('lang="en" dir="ltr"');
    for(const page of [ar,en]){
      expect(page).toContain('/lib/forms/funding-case-context.js?v=1');
      expect(page).not.toContain('funding_case_id:fundingCase?.id||null');
      expect(page).toContain("syncSubmission(sb,fundingCase,'activity'");
    }
    const migration=read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'client_business_activity_profiles','{}'::jsonb,'account'");
  });

  test('database uses authenticated owner-only RLS',()=>{
    const migration=read('supabase/migrations/20261014025500_client_business_activity_profile.sql');
    expect(migration).toContain('ALTER TABLE public.client_business_activity_profiles ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('user_id = auth.uid()');
    expect(migration).toContain("status IN ('draft','submitted')");
  });
});
