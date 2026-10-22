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
});
