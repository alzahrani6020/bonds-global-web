'use strict';

const fs = require('fs');
const path = require('path');

describe('assistant diagnostics widget contract', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../v3/components/ai-chat-widget.js'),
    'utf8'
  );

  test('diagnostics panel is hidden until server-authorized diagnostics arrive', () => {
    expect(source).toContain('.bonds-ai-request-diagnostics {');
    expect(source).toContain('display:none;');
    expect(source).toContain("diagnosticsPanel.classList.add('visible')");
    expect(source).toContain('responseDiagnostics = data?.diagnostics || null');
  });

  test('client diagnostics persist only a safe metadata whitelist', () => {
    expect(source).toContain('function safeDiagnosticRecord(value)');
    expect(source).toContain('request_id:');
    expect(source).toContain('failure_stage:');
    expect(source).toContain('error_code:');
    expect(source).not.toContain('diagnosticHistory = [data');
  });

  test('client adds delivery, parse and render checkpoints', () => {
    expect(source).toContain("stage:'api_delivery'");
    expect(source).toContain("stage:'response_parse'");
    expect(source).toContain("stage:'ui_render'");
  });
});
