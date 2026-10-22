const fs=require('fs');
const path=require('path');

describe('BONDS homepage assistant chat UI',()=>{
  const widget=fs.readFileSync(path.join(__dirname,'..','..','v3','components','ai-chat-widget.js'),'utf8');
  const home=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');

  test('mounts the governed assistant widget on the homepage',()=>{
    expect(home).toContain('/v3/components/ai-chat-widget.js');
    expect(home).toContain('window.BondsAIChat.mount({');
    expect(home).toContain('home: true');
  });

  test('uses the approved left-side institutional desktop layout',()=>{
    expect(widget).toContain("root.classList.add('bonds-ai-home')");
    expect(widget).toContain('width: min(420px, calc(100vw - 48px));');
    expect(widget).toContain('height: min(650px, calc(100vh - 140px));');
    expect(widget).toContain('left: 24px;');
  });

  test('provides six service entry points and three direct prompts',()=>{
    const serviceMatches=widget.match(/class="bonds-ai-home-service"/g)||[];
    expect(serviceMatches).toHaveLength(6);
    expect(widget).toContain('الحاسبات المالية');
    expect(widget).toContain('طلب تمويل');
    expect(widget).toContain('الاستشارات والخدمات');
    expect(widget).toContain('دراسات الجدوى');
    expect(widget).toContain('القطاعات والفرص');
    expect(widget).toContain('الأسئلة العامة');
    expect(widget).toContain('كيف أحصل على تمويل مناسب؟');
    expect(widget).toContain('ما متطلبات إعداد دراسة جدوى؟');
    expect(widget).toContain('ما القطاعات الاستثمارية التي يمكنني دراستها؟');
  });

  test('collapses the service launchpad once a real conversation starts',()=>{
    expect(widget).toContain("root.classList.add('conversation-started')");
    expect(widget).toContain('.bonds-ai-home.conversation-started .bonds-ai-home-launchpad');
  });

  test('keeps the existing governed AI and assistant endpoints intact',()=>{
    expect(widget).toContain("const API_URL = '/api/v3/ai/chat';");
    expect(widget).toContain("const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan';");
    expect(widget).toContain('executeStructuredAction(action, button)');
  });

  test('uses full-screen chat on mobile',()=>{
    expect(widget).toContain('@media (max-width: 640px)');
    expect(widget).toContain('width: 100vw;');
    expect(widget).toContain('height: 100dvh;');
  });
});
