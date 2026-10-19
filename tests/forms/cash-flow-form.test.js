/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('cash flow client form',()=>{
  test('captures 12-month operating, financing, and investing cash flows',()=>{
    const page=read('client/cash-flow.html');
    expect(page).toContain('نموذج التدفقات النقدية');
    expect(page).toContain('مبيعات/تحصيل نقدي');
    expect(page).toContain('تحصيل ذمم مدينة');
    expect(page).toContain('خدمة الدين');
    expect(page).toContain('CapEx');
    expect(page).toContain('فجوة التمويل');
    expect(page).toContain("from('client_cash_flow_reports')");
  });

  test('supports branded print PDF Excel and Word exports',()=>{
    const page=read('client/cash-flow.html');
    for(const f of ['print','pdf','excel','word']) expect(page).toContain(`data-export="${f}"`);
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('server recalculates 12 months and funding gap',()=>{
    const migration=read('supabase/migrations/20261014021500_client_cash_flow.sql');
    expect(migration).toContain('normalize_cash_flow_report');
    expect(migration).toContain("jsonb_array_length(NEW.months) <> 12");
    expect(migration).toContain("'funding_gap', GREATEST(0, -min_balance)");
    expect(migration).toContain("'net_cash_flow', total_inflows - total_outflows");
  });

  test('Arabic and English counterparts exist',()=>{
    expect(read('client/cash-flow.html')).toContain('lang="ar" dir="rtl"');
    expect(read('en/client/cash-flow.html')).toContain('lang="en" dir="ltr"');
  });

  test('funding registry exposes cash flow form',()=>{
    const migration=read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'cash_flow'");
    expect(migration).toContain("'/client/cash-flow'");
    expect(migration).toContain("'/en/client/cash-flow'");
  });
});
