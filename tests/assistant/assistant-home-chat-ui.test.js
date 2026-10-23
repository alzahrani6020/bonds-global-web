const fs=require('fs');
const path=require('path');

describe('BONDS unified assistant workspace UI',()=>{
  const widget=fs.readFileSync(path.join(__dirname,'..','..','v3','components','ai-chat-widget.js'),'utf8');
  const home=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
  const layout=fs.readFileSync(path.join(__dirname,'..','..','site-layout.js'),'utf8');

  test('uses one shared assistant mount authority across the site',()=>{
    expect(layout).toContain('function ensureGlobalAssistantRuntime()');
    expect(layout).toContain("window.BondsAIChat.mount({");
    expect(layout).toContain("global: true");
    expect(home).not.toContain('home: true');
    expect(home).not.toContain('home-assistant-1');
  });

  test('uses one institutional standard size instead of homepage and global variants',()=>{
    expect(widget).toContain("root.classList.add('bonds-ai-unified')");
    expect(widget).not.toContain("root.classList.add('bonds-ai-home')");
    expect(widget).toContain('width: min(420px, calc(100vw - 48px));');
    expect(widget).toContain('height: min(650px, calc(100vh - 140px));');
  });

  test('provides standard workspace fullscreen and collapsed view modes',()=>{
    expect(widget).toContain("['standard', 'workspace', 'fullscreen', 'collapsed']");
    expect(widget).toContain("data-assistant-view=\"standard\"");
    expect(widget).toContain("data-assistant-view=\"workspace\"");
    expect(widget).toContain("data-assistant-view=\"fullscreen\"");
    expect(widget).toContain("data-assistant-view=\"collapsed\"");
    expect(widget).toContain('.bonds-ai-chat-window.view-workspace');
    expect(widget).toContain('.bonds-ai-chat-window.view-fullscreen');
    expect(widget).toContain('.bonds-ai-chat-window.view-collapsed');
  });

  test('keeps six service entry points and direct prompts in the unified launchpad',()=>{
    const serviceMatches=widget.match(/class="bonds-ai-home-service"/g)||[];
    expect(serviceMatches).toHaveLength(6);
    expect(widget).toContain('الحاسبات المالية');
    expect(widget).toContain('طلب تمويل');
    expect(widget).toContain('الاستشارات والخدمات');
    expect(widget).toContain('دراسات الجدوى');
    expect(widget).toContain('القطاعات والفرص');
    expect(widget).toContain('الأسئلة العامة');
  });

  test('promotes structured work into workspace without changing assistant identity',()=>{
    expect(widget).toContain("root.classList.add('conversation-started')");
    expect(widget).toContain("state.viewMode === 'standard'");
    expect(widget).toContain("setViewMode('workspace')");
    expect(widget).toContain('renderStructuredEnvelope(data)');
  });

  test('keeps the existing governed AI and assistant endpoints intact',()=>{
    expect(widget).toContain("const API_URL = '/api/v3/ai/chat';");
    expect(widget).toContain("const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan';");
    expect(widget).toContain('executeStructuredAction(action, button)');
  });

  test('integrates voice as an input-output adapter in the same assistant shell',()=>{
    expect(widget).toContain('class="bonds-ai-voice-button"');
    expect(widget).toContain("window.SpeechRecognition || window.webkitSpeechRecognition");
    expect(widget).toContain('function startRecognition()');
    expect(widget).toContain("input.value = transcript");
    expect(widget).toContain("voiceBtn.addEventListener('click', startRecognition)");
    expect(widget).toContain('function speakAssistantText(text, button)');
    expect(widget).toContain('new window.SpeechSynthesisUtterance(value)');
    expect(widget).toContain('window.speechSynthesis.speak(utterance)');
    expect(widget).toContain('window.BondsAssistant.voice = Object.freeze');
  });

  test('keeps voice outside backend execution and preserves the existing sendMessage path',()=>{
    expect(widget).toContain("sendBtn.addEventListener('click', () => sendMessage(input.value))");
    expect(widget).not.toContain('/api/v3/voice');
    expect(widget).not.toContain('MediaRecorder');
    expect(widget).not.toContain('getUserMedia');
    expect(widget).toContain("voiceBtn.hidden = !voiceInputSupported()");
  });

  test('uses page language and country context for Arabic speech locale without forcing Saudi locale',()=>{
    expect(widget).toContain('const ARABIC_SPEECH_LOCALES = Object.freeze');
    expect(widget).toContain("SA: 'ar-SA'");
    expect(widget).toContain("EG: 'ar-EG'");
    expect(widget).toContain("AE: 'ar-AE'");
    expect(widget).toContain("return ARABIC_SPEECH_LOCALES[country] || 'ar';");
  });

  test('accepts governed file and image attachments in the same assistant shell',()=>{
    expect(widget).toContain('class="bonds-ai-file-input"');
    expect(widget).toContain('class="bonds-ai-attach-button"');
    expect(widget).toContain('multiple hidden');
    expect(widget).toContain("const CLIENT_DOCUMENTS_BUCKET = 'client-documents';");
    expect(widget).toContain("const CLIENT_DOCUMENTS_QUARANTINE_BUCKET = 'client-documents-quarantine';");
    expect(widget).toContain("executeAttachmentCapability('media_classify'");
    expect(widget).toContain("executeAttachmentCapability('file_security_scan'");
    expect(widget).toContain("executeAttachmentCapability('document_analyze'");
    expect(widget).toContain(".from('client_documents')");
    expect(widget).toContain(".from(CLIENT_DOCUMENTS_QUARANTINE_BUCKET)");
    expect(widget).toContain("context.attachments = state.attachments");
    expect(widget).not.toContain('/api/v3/upload');
  });

  test('supports drag drop and pasted files without adding a second assistant',()=>{
    expect(widget).toContain("windowEl.addEventListener('dragover'");
    expect(widget).toContain("windowEl.addEventListener('drop'");
    expect(widget).toContain("input.addEventListener('paste'");
    expect(widget).toContain('handleAttachmentFiles');
  });

  test('uses full-screen chat on mobile',()=>{
    expect(widget).toContain('@media (max-width: 640px)');
    expect(widget).toContain('width: 100vw;');
    expect(widget).toContain('height: 100dvh;');
  });
});
