'use strict';

const { buildRequestDiagnostics, STATUS } = require('../../lib/assistant/request-diagnostics');

describe('assistant request diagnostics', () => {
  test('reports a successful research pipeline from execution metadata', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-1',
      path:'OPEN_CHAT_RESEARCH',
      totalMs:2500,
      loopResult:{
        ok:true,
        reply:'answer',
        failed:false,
        trace:[
          { action:'web_search', execution:{ ok:true } },
          { action:'web_explore', execution:{ ok:true } },
          { action:'evidence_verify', execution:{ ok:true } },
          { action:'research_synthesize', execution:{ ok:true } }
        ],
        research:{
          status:'completed',
          initial_quality_code:'PASS',
          repair_attempted:false,
          decision_eligible:true,
          source_count:3,
          evidence_count:4,
          verification_state:'verified',
          timings:{ search_ms:120, explore_ms:340, verify_ms:80, synthesize_ms:60 },
          research_acquisition_ms:900,
          answer_synthesis_ms:500,
          elapsed_ms:2200,
          unknowns:[],
          contradictions:[]
        }
      }
    });

    expect(result.status).toBe(STATUS.PASS);
    expect(result.failure_stage).toBeNull();
    expect(result.error_code).toBeNull();
    expect(result.total_ms).toBe(2500);
    expect(result.stages.find(row => row.stage === 'search').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'initial_quality_gate').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'repair_attempt').status).toBe(STATUS.NOT_REQUIRED);
    expect(result.stages.find(row => row.stage === 'research_acquisition').duration_ms).toBe(900);
    expect(result.evidence).toEqual(expect.objectContaining({
      source_count:3,
      evidence_count:4,
      decision_eligible:true
    }));
  });

  test('does not treat HTTP-success quality rejection as final success', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-quality',
      path:'OPEN_CHAT_RESEARCH',
      totalMs:3100,
      loopResult:{
        ok:true,
        reply:'safe failure response',
        failed:true,
        trace:[
          { action:'web_search', execution:{ ok:true } },
          { action:'web_explore', execution:{ ok:true } },
          { action:'evidence_verify', execution:{ ok:true } },
          { action:'research_synthesize', execution:{ ok:true } }
        ],
        research:{
          status:'ANSWER_QUALITY_FAILED',
          quality_code:'PERSON_IDENTITY_TOO_GENERIC',
          initial_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
          repair_attempted:true,
          repair_ms:300,
          repair_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
          repair_succeeded:false,
          decision_eligible:true,
          timings:{ search_ms:100, explore_ms:200, verify_ms:50, synthesize_ms:40 },
          research_acquisition_ms:1200,
          answer_synthesis_ms:700,
          elapsed_ms:2800
        }
      }
    });

    expect(result.status).toBe(STATUS.FAIL);
    expect(result.failure_stage).toBe('initial_quality_gate');
    expect(result.error_code).toBe('PERSON_IDENTITY_TOO_GENERIC');
    expect(result.stages.find(row => row.stage === 'search').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'evidence').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'ai_generate').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'initial_quality_gate').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'repair_attempt').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'repair_quality_gate').status).toBe(STATUS.FAIL);
    expect(result.research_quality).toEqual(expect.objectContaining({
      initial_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
      repair_attempted:true,
      repair_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
      repair_succeeded:false
    }));
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.FAIL);
  });

  test('marks native fallback as degraded rather than clean pass', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-fallback',
      path:'NATIVE_DIRECT',
      totalMs:900,
      aiResult:{ reply:'answer', provider:'BONDS_FALLBACK', inference:{ request_elapsed_ms:700 } },
      nativeError:{ code:'NATIVE_RUNTIME_UNAVAILABLE', elapsedMs:100 }
    });

    expect(result.status).toBe(STATUS.DEGRADED);
    expect(result.fallback_used).toBe(true);
    expect(result.fallback_reason).toBe('NATIVE_RUNTIME_UNAVAILABLE');
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.PASS);
  });

  test('diagnostics output is metadata-only and excludes raw trace payloads', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-safe',
      path:'OPEN_CHAT_RESEARCH',
      loopResult:{
        ok:true,
        reply:'answer',
        trace:[{
          action:'web_search',
          input:{ authorization:'Bearer SECRET', prompt:'PRIVATE PROMPT' },
          execution:{
            ok:false,
            error:{ code:'SEARCH_FAILED', message:'failed' },
            result:{ secret:'DO_NOT_EXPOSE' },
            evidence:{ text:'PRIVATE EVIDENCE' }
          }
        }],
        research:{ status:'search_failed', decision_eligible:false }
      }
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Bearer SECRET');
    expect(serialized).not.toContain('PRIVATE PROMPT');
    expect(serialized).not.toContain('DO_NOT_EXPOSE');
    expect(serialized).not.toContain('PRIVATE EVIDENCE');
    expect(serialized).toContain('SEARCH_FAILED');
  });
});
