/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('payables aging form',()=>{
  test('captures supplier aging buckets and persistence',()=>{
    const page=read('client/payables-aging.html');
    expect(page).toContain('نموذج أعمار الذمم الدائنة');
    expect(page).toContain('المورد');
    for(const bucket of ['غير مستحق','1–30','31–60','61–90','91–120','أكثر من 120']){
      expect(page).toContain(bucket);
    }
    expect(page).toContain("from('client_payables_aging_reports')");
  });

  test('supports branded exports',()=>{
    const page=read('client/payables-aging.html');
    for(const f of ['print','pdf','excel','word']){
      expect(page).toContain(`data-export="${f}"`);
    }
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('server validates and recalculates payable aging',()=>{
    const migration=read('supabase/migrations/20261014014500_client_payables_aging.sql');
    expect(migration).toContain('normalize_payables_aging_report');
    expect(migration).toContain('paid amount cannot exceed invoice amount');
    expect(migration).toContain("NEW.summary := jsonb_build_object");
  });

  test('funding registry exposes payables aging in both languages',()=>{
    const migration=read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'payables'");
    expect(migration).toContain("'/client/payables-aging'");
    expect(migration).toContain("'/en/client/payables-aging'");
  });
});
