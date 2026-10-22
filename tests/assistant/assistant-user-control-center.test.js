/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Assistant User Control Center',()=>{
  const page=fs.readFileSync(path.join(process.cwd(),'calculators','auth','assistant-control.html'),'utf8');
  const widget=fs.readFileSync(path.join(process.cwd(),'v3','components','ai-chat-widget.js'),'utf8');
  const profile=fs.readFileSync(path.join(process.cwd(),'calculators','auth','profile.html'),'utf8');
  const enPage=fs.readFileSync(path.join(process.cwd(),'en','calculators','auth','assistant-control.html'),'utf8');
  const enProfile=fs.readFileSync(path.join(process.cwd(),'en','calculators','auth','profile.html'),'utf8');

  test('keeps context preference session-scoped and provides explicit clearing',()=>{
    expect(page).toContain("const CONTEXT_PREF_KEY='bonds.assistant.context.enabled.v1'");
    expect(page).toContain("const STATE_PREFIX='bonds.assistant.state.v1:'");
    expect(page).toContain('window.sessionStorage.setItem');
    expect(page).toContain('window.sessionStorage.removeItem');
    expect(page).not.toContain('window.localStorage');
  });

  test('reuses existing user-scoped notification API',()=>{
    expect(page).toContain('/api/v3/assistant/notifications?limit=25');
    expect(page).toContain('/api/v3/assistant/notifications/read');
    expect(page).toContain('BondsAuth.authenticatedFetch');
    expect(page).not.toContain('/api/v3/assistant/user-control');
  });

  test('widget omits structured assistant state when user disables context',()=>{
    expect(widget).toContain("const ASSISTANT_CONTEXT_PREFERENCE_KEY = 'bonds.assistant.context.enabled.v1';");
    expect(widget).toContain("window.sessionStorage?.getItem(ASSISTANT_CONTEXT_PREFERENCE_KEY) !== '0'");
    expect(widget).toContain('const structuredState = assistantContextEnabled()');
    expect(widget).toContain(': null;');
    expect(widget).toContain('window.BondsAssistant.isContextEnabled = assistantContextEnabled;');
  });

  test('does not expose provider model token or compute controls',()=>{
    expect(page).toContain('دون تغيير التوكن أو مزود AI/API أو الموديل');
    expect(page).not.toContain('providerSelect');
    expect(page).not.toContain('modelSelect');
    expect(page).not.toContain('tokenLimit');
    expect(page).not.toContain('computeLimit');
  });

  test('is reachable from both existing user profiles',()=>{
    expect(profile).toContain('href="./assistant-control.html"');
    expect(profile).toContain('مركز تحكم المساعد');
    expect(enProfile).toContain('href="./assistant-control.html"');
    expect(enProfile).toContain('Assistant Control Center');
    expect(enPage).toContain("const CONTEXT_PREF_KEY='bonds.assistant.context.enabled.v1'");
  });
});
