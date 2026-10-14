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

  test('Arabic and English counterparts exist and menu exposes form',()=>{
    expect(read('client/business-activity.html')).toContain('lang="ar" dir="rtl"');
    expect(read('en/client/business-activity.html')).toContain('lang="en" dir="ltr"');
    const layout=read('site-layout.js');
    expect(layout).toContain("businessActivityInfo: isEn ? 'Business Activity Information' : 'معلومات النشاط'");
    expect(layout).toContain("const businessActivityInfoHref = isEn ? '/en/client/business-activity' : '/client/business-activity';");
    expect(layout).toContain('{ label: labels.businessActivityInfo, href: businessActivityInfoHref }');
  });

  test('database uses authenticated owner-only RLS',()=>{
    const migration=read('supabase/migrations/20261014025500_client_business_activity_profile.sql');
    expect(migration).toContain('ALTER TABLE public.client_business_activity_profiles ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('user_id = auth.uid()');
    expect(migration).toContain("status IN ('draft','submitted')");
  });
});
