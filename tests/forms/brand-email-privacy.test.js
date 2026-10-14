/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('forms brand and email privacy',()=>{
  test('exporter uses the same logo asset as the live site header',()=>{
    const layout=read('site-layout.js');
    const exporter=read('lib/forms/branded-export.js');
    expect(layout).toContain('/assets/bonds-logo-2026-v2-sm.webp?v=2026f');
    expect(exporter).toContain("const LOGO='/assets/bonds-logo-2026-v2-sm.webp?v=2026f'");
  });

  test('KYC does not prefill the signed-in account email and shows mail glyph placeholder',()=>{
    for(const file of ['client/kyc.html','en/client/kyc.html']){
      const page=read(file);
      expect(page).toContain('id="email" type="email" placeholder="✉"');
      expect(page).not.toContain("setVal('email',user.email||'')");
    }
  });

  test('exports mask email addresses as a mail glyph',()=>{
    const arKyc=read('client/kyc.html');
    const enKyc=read('en/client/kyc.html');
    const arEst=read('client/establishment-information.html');
    const enEst=read('en/client/establishment-information.html');
    expect(arKyc).toContain("['البريد الإلكتروني',i.email?'✉':'']");
    expect(enKyc).toContain("['Email',i.email?'✉':'']");
    expect(arEst).toContain("['البريد الإلكتروني',c.email?'✉':'']");
    expect(enEst).toContain("['Email',c.email?'✉':'']");
  });

  test('all client forms load branded export v3',()=>{
    for(const file of [
      'client/kyc.html','client/receivables-aging.html','client/establishment-information.html',
      'client/payables-aging.html','client/cash-flow.html','client/business-activity.html',
      'en/client/kyc.html','en/client/receivables-aging.html','en/client/establishment-information.html',
      'en/client/payables-aging.html','en/client/cash-flow.html','en/client/business-activity.html'
    ]) expect(read(file)).toContain('/lib/forms/branded-export.js?v=3');
  });
});
