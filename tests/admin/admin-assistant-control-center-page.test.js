/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Assistant Control Center page contract',()=>{
  const html=fs.readFileSync(
    path.join(process.cwd(),'admin','assistant-control-center.html'),
    'utf8'
  );

  test('uses existing audited AI operations endpoints only',()=>{
    expect(html).toContain('/api/admin?action=ai-operations');
    expect(html).toContain('/api/admin?action=ai-kill-switch-update');
    expect(html).not.toContain('/api/v3/admin/assistant-control');
  });

  test('does not expose arbitrary feature input',()=>{
    expect(html).not.toContain('name="feature"');
    expect(html).not.toContain('id="featureInput"');
    expect(html).toContain('Control.FEATURES.global');
    expect(html).toContain('Control.FEATURES.readOnly');
  });

  test('requires typed confirmation and browser confirmation',()=>{
    expect(html).toContain('requiredPhrase');
    expect(html).toContain('confirmInput');
    expect(html).toContain('window.confirm');
  });

  test('states that token/provider/model controls are out of scope',()=>{
    expect(html).toContain('لا يغيّر التوكن');
    expect(html).toContain('مزود AI/API');
    expect(html).toContain('الموديل');
  });

  test('adds evolution review through the admin-only analysis endpoint',()=>{
    expect(html).toContain('/api/v3/admin/evolution-proposals?status=proposed&limit=50');
    expect(html).toContain("method:'POST'");
    expect(html).toContain('تحليل المقترحات');
    expect(html).toContain('execution_authorized=false');
    expect(html).toContain('auto_execute=false');
    expect(html).toContain('no code mutation');
  });

  test('does not expose evolution approval or execution controls',()=>{
    expect(html).not.toContain('evolution-proposals/approve');
    expect(html).not.toContain('evolution-proposals/execute');
    expect(html).not.toContain('اعتماد المقترح');
    expect(html).not.toContain('تنفيذ المقترح');
  });
});
