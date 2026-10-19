/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('generic credit consent forms',()=>{
  test('provides separate business and individual forms in Arabic and English',()=>{
    for(const file of [
      'client/credit-consent-business.html','client/credit-consent-individual.html',
      'en/client/credit-consent-business.html','en/client/credit-consent-individual.html'
    ]){
      const page=read(file);
      expect(page).toContain('data-credit-consent-form');
      expect(page).toContain('/lib/forms/credit-consent-form.js?v=2');
      expect(page).toContain('/lib/forms/credit-consent-terminology.js?v=1');
      expect(page).toContain('/lib/forms/branded-export.js?v=3');
    }
  });

  test('uses localized auth routes for Arabic and English pages',()=>{
    const controller=read('lib/forms/credit-consent-form.js');
    const gate=read('calculators/auth-gate.js');
    expect(controller).toContain("const authPath=isEn?'/en/calculators/auth/index.html':'/calculators/auth/index.html'");
    expect(gate).toContain("const authPath = path.startsWith('/en/') ? '/en/calculators/auth/index.html' : '/calculators/auth/index.html'");
    for(const file of [
      'client/credit-consent-business.html','client/credit-consent-individual.html',
      'en/client/credit-consent-business.html','en/client/credit-consent-individual.html'
    ]){
      expect(read(file)).toContain('/calculators/auth-gate.js?v=4');
    }
  });

  test('country selector uses the platform geographic catalog and has a generic fallback',()=>{
    const controller=read('lib/forms/credit-consent-form.js');
    const terminology=read('lib/forms/credit-consent-terminology.js');
    expect(controller).toContain('window.BondsGeo.getCountries');
    expect(controller).toContain('BondsCreditConsentTerminology?.consentTitle');
    expect(terminology).toContain("return lang==='en'?'Credit Information Consent':'نموذج الموافقة على المعلومات الائتمانية'");
  });

  test('consent language is institution-neutral and records auditable consent details',()=>{
    const controller=read('lib/forms/credit-consent-form.js');
    expect(controller).toContain('المصادر المرخصة أو المصرح لها نظامًا');
    expect(controller).toContain('licensed or legally authorized sources');
    expect(controller).toContain("consent_text_version:'2026-10'");
    expect(controller).toContain("consented_at:status==='submitted'");
    expect(controller).toContain("from('client_credit_consents')");
  });

  test('credit consent data is protected by authenticated owner-only RLS',()=>{
    const migration=read('supabase/migrations/20261014033000_client_credit_consents.sql');
    expect(migration).toContain('ALTER TABLE public.client_credit_consents ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('user_id = auth.uid()');
    expect(migration).toContain("subject_type IN ('business','individual')");
  });

  test('funding registry exposes both consent requirements and controller binds them to a case',()=>{
    const migration=read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'credit_business'");
    expect(migration).toContain("'credit_individual'");
    expect(migration).toContain("'/client/credit-consent-business'");
    expect(migration).toContain("'/en/client/credit-consent-individual'");
    const controller=read('lib/forms/credit-consent-form.js');
    expect(controller).toContain('funding_case_id:fundingCase?.id||null');
    expect(controller).toContain("existingQuery=existingQuery.eq('funding_case_id',fundingCase.id)");
    expect(controller).toContain("syncSubmission(sb,fundingCase,subjectType==='business'?'credit_business':'credit_individual'");
    expect(migration).toContain('add column if not exists notes text');
  });
});

describe('expanded business activity information',()=>{
  test('adds workforce premises management stability and financial history',()=>{
    const page=read('client/business-activity.html');
    expect(page).toContain('القوى العاملة ومقر النشاط');
    expect(page).toContain('الموظفون المحليون — حاليًا');
    expect(page).toContain('استقرار الإدارة');
    expect(page).toContain('نبذة وتاريخ النشاط');
    expect(page).toContain('هل تتوفر قوائم مالية؟');
    expect(page).toContain('مبيعات السنة الماضية');
  });

  test('stores and exports the added activity information',()=>{
    const page=read('client/business-activity.html');
    expect(page).toContain("premises_tenure:g('premisesTenure').value");
    expect(page).toContain("management_stability:g('managementStability').value");
    expect(page).toContain("has_financial_statements:g('hasFinancialStatements').value");
    expect(page).toContain("title:'البيانات المالية التاريخية'");
  });
});
