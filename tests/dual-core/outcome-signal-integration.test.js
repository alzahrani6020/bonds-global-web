'use strict';

const fs=require('fs');
const path=require('path');
const { EVENT_TYPES, validateEvent }=require('../../lib/dual-core/event-taxonomy');
const { thresholdFor, proposalSeverity }=require('../../lib/dual-core/evolution-proposal-aggregator');

const assistantSource=fs.readFileSync(path.join(__dirname,'../../v3/api/assistant.js'),'utf8');
const aiSource=fs.readFileSync(path.join(__dirname,'../../v3/api/ai.js'),'utf8');
const documentSource=fs.readFileSync(path.join(__dirname,'../../lib/api/analyze-document.js'),'utf8');

describe('dual-core operational outcome coverage',()=>{
  test('workflow.blocked is a registered Core A event with bounded proposal threshold',()=>{
    const event={
      id:'evt-1',
      type:EVENT_TYPES.WORKFLOW_BLOCKED,
      occurred_at:new Date().toISOString(),
      payload:{}
    };
    expect(validateEvent(event)).toBe(true);
    expect(thresholdFor(EVENT_TYPES.WORKFLOW_BLOCKED)).toBe(3);
    expect(proposalSeverity(EVENT_TYPES.WORKFLOW_BLOCKED)).toBe('medium');
  });

  test('assistant workflow conflicts emit workflow.blocked without changing response handling',()=>{
    expect(assistantSource).toContain("type:DUAL_CORE_EVENT_TYPES.WORKFLOW_BLOCKED");
    expect(assistantSource).toContain("error_code:err.message");
    expect(assistantSource).toContain("return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503");
  });

  test('document parser failures emit document.extraction.failed only inside parser catch',()=>{
    const catchIndex=documentSource.indexOf("extracted.error_code = code;");
    const signalIndex=documentSource.indexOf("type:DUAL_CORE_EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED");
    expect(catchIndex).toBeGreaterThan(-1);
    expect(signalIndex).toBeGreaterThan(catchIndex);
    expect(documentSource).toContain("error_code:code");
    expect(documentSource).toContain("source:'analyze-document'");
  });

  test('AI fallback distinguishes unresolved intent from resolved-context low confidence',()=>{
    expect(aiSource).toContain("DUAL_CORE_EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE");
    expect(aiSource).toContain("DUAL_CORE_EVENT_TYPES.ASSISTANT_INTENT_FAILED");
    expect(aiSource).toContain("const hasResolvedIntentContext = Boolean(");
    expect(aiSource).not.toContain("raw_prompt");
  });
});
