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
    expect(source).toContain('pipeline_stage:');
    expect(source).toContain('root_cause_stage:');
    expect(source).toContain('failure_stage:');
    expect(source).toContain('error_code:');
    expect(source).not.toContain('diagnosticHistory = [data');
  });

  test('client records explicit round-trip, parse, render and end-to-end timing', () => {
    expect(source).toContain("stage:'http_roundtrip'");
    expect(source).toContain("stage:'client_parse'");
    expect(source).toContain("stage:'ui_render'");
    expect(source).toContain('api_roundtrip_ms:apiRoundtripMs');
    expect(source).toContain('client_parse_ms:clientParseMs');
    expect(source).toContain('ui_render_ms:uiRenderMs');
    expect(source).toContain('end_to_end_ms:endToEndMs');
  });
  test('renders explicit acquisition and quality-repair stages', () => {
    expect(source).toContain("research_acquisition:'Research Acquisition'");
    expect(source).toContain("search_transport:'Search Transport'");
    expect(source).toContain("search_relevance:'Search Relevance'");
    expect(source).toContain("initial_quality_gate:'Initial Quality Gate'");
    expect(source).toContain("repair_attempt:'Repair Attempt'");
    expect(source).toContain("repair_quality_gate:'Repair Quality Gate'");
    expect(source).toContain('repair_attempted:');
    expect(source).toContain('repair_succeeded:');
  });

  test('renders diagnostics v2 root cause and explicit server/end-to-end timing', () => {
    expect(source).toContain('schema_version:Number(value.schema_version) === 2 ? 2 : 1');
    expect(source).toContain("['Pipeline', safe.pipeline_stage || '—']");
    expect(source).toContain("['Root Cause', safe.root_cause_stage || '—']");
    expect(source).toContain("['Server', safe.timing?.server_processing_ms");
    expect(source).toContain("['End-to-End', safe.timing?.end_to_end_ms");
  });

  test('workspace keeps diagnostics bounded and prioritizes answer space', () => {
    expect(source).toContain('grid-template-columns: minmax(0, 1.1fr) minmax(460px, 0.9fr)');
    expect(source).toContain('max-height:280px');
    expect(source).toContain('min-height: 220px');
    expect(source).toContain('overflow-y:auto');
  });

  test('diagnostics stay compact by default and expose details only on demand', () => {
    expect(source).toContain('class="bonds-ai-diagnostics-toggle"');
    expect(source).toContain('const shouldExpand = false;');
    expect(source).toContain("diagnosticsPanel.classList.remove('expanded')");
    expect(source).toContain("diagnosticsToggle.addEventListener('click'");
  });

  test('keeps the final assistant answer visible after render', () => {
    expect(source).toContain("latestAssistantMessage?.scrollIntoView?.({ block:'nearest', behavior:'smooth' });");
  });

  test('renders research acquisition counters in diagnostics', () => {
    expect(source).toContain('acquisition_trace:');
    expect(source).toContain("['Search Results', safe.acquisition_trace?.search_result_count ?? '—']");
    expect(source).toContain("['Crawl Fetched', safe.acquisition_trace?.fetched_count ?? '—']");
    expect(source).toContain("['Crawl Failed', safe.acquisition_trace?.failed_count ?? '—']");
    expect(source).toContain("['Crawl Blocked', safe.acquisition_trace?.blocked_count ?? '—']");
    expect(source).toContain("['Relevant Pages', safe.acquisition_trace?.relevant_page_count ?? '—']");
    expect(source).toContain("['Verified Sources', safe.acquisition_trace?.verified_source_count ?? '—']");
    expect(source).toContain("'crawl_fetched=' + (record.acquisition_trace?.fetched_count ?? 'n/a')");
  });

});
