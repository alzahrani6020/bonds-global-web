/** @jest-environment node */
const fs=require('fs');
const path=require('path');

describe('Assistant SSE transport streaming',()=>{
  const api=fs.readFileSync(path.join(process.cwd(),'v3','api','ai.js'),'utf8');
  const widget=fs.readFileSync(path.join(process.cwd(),'v3','components','ai-chat-widget.js'),'utf8');

  test('keeps legacy JSON responses and makes SSE opt-in',()=>{
    expect(api).toContain("function sendJson(res, status, data)");
    expect(api).toContain("accept.includes('text/event-stream') || body?.options?.stream === true");
    expect(api).toContain("function sendAssistantResponse(res, status, data, { stream = false } = {})");
  });

  test('streams truthful lifecycle events without claiming token deltas',()=>{
    expect(api).toContain("writeEvent(res, 'status', { phase:'preparing', source:'assistant' })");
    expect(api).toContain("writeEvent(res, 'status', { phase:'inference', source:'bonds-assistant-ai', token_streaming:false })");
    expect(api).toContain("writeEvent(res, 'final', data)");
    expect(api).toContain("writeEvent(res, 'error'");
    expect(api).toContain("token_streaming:false");
    expect(api).not.toContain("writeEvent(res, 'delta'");
  });

  test('does not alter provider model token context or compute controls',()=>{
    expect(api).toContain("provider: 'BONDS'");
    expect(api).toContain("model: null");
    expect(api).not.toContain("provider: 'BondsNativeProvider'");
    expect(api).not.toContain("model: 'bonds-native'");
    expect(api).toContain("max_tokens: maxTokens");
    expect(api).not.toContain("streamingMaxTokens");
    expect(api).not.toContain("streamingModel");
    expect(api).not.toContain("streamingProvider");
  });

  test('widget requests SSE only for ordinary Assistant chat and retains JSON fallback',()=>{
    expect(widget).toContain("options: { stream: true }");
    expect(widget).toContain("if (!isProjectMode) headers.Accept = 'text/event-stream';");
    expect(widget).toContain("contentType.includes('text/event-stream')");
    expect(widget).toContain(": await res.json()");
    expect(widget).toContain("readAssistantEventStream(res)");
  });

  test('client requires a final event and handles status/error events',()=>{
    expect(widget).toContain("if (event === 'status')");
    expect(widget).toContain("if (event === 'error')");
    expect(widget).toContain("if (event === 'final')");
    expect(widget).toContain("STREAM_FINAL_EVENT_MISSING");
  });
});
