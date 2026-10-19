/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('establishment information form',()=>{
  test('captures core legal and operational establishment data',()=>{
    const page=read('client/establishment-information.html');
    expect(page).toContain('نموذج معلومات المنشأة');
    expect(page).toContain('رقم السجل التجاري');
    expect(page).toContain('الرقم الوطني الموحد');
    expect(page).toContain('الرقم الضريبي / VAT');
    expect(page).toContain('النشاط الرئيسي');
    expect(page).toContain('اسم الممثل / المفوض');
    expect(page).toContain("from('client_establishment_profiles')");
  });

  test('does not auto-fill the signed-in account email',()=>{
    const ar=read('client/establishment-information.html');
    const en=read('en/client/establishment-information.html');
    expect(ar).toContain('id="email" type="email" placeholder="✉"');
    expect(en).toContain('id="email" type="email" placeholder="✉"');
    expect(ar).not.toContain("set('email',user.email||'')");
    expect(en).not.toContain("set('email',user.email||'')");
  });

  test('supports branded print, PDF, Excel, and Word exports',()=>{
    const page=read('client/establishment-information.html');
    for(const f of ['print','pdf','excel','word']){
      expect(page).toContain(`data-export="${f}"`);
    }
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('Arabic and English counterparts exist',()=>{
    expect(read('client/establishment-information.html')).toContain('lang="ar" dir="rtl"');
    expect(read('en/client/establishment-information.html')).toContain('lang="en" dir="ltr"');
  });

  test('funding registry exposes establishment information',()=>{
    const migration=read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'establishment'");
    expect(migration).toContain("'/client/establishment-information'");
    expect(migration).toContain("'/en/client/establishment-information'");
  });
});
