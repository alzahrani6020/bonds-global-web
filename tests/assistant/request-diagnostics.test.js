'use strict';

const { buildRequestDiagnostics, sanitizeNativeTelemetryRows, STATUS } = require('../../lib/assistant/request-diagnostics');

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
    expect(result.schema_version).toBe(2);
    expect(result.total_ms).toBe(2500);
    expect(result.timing.server_processing_ms).toBe(2500);
    expect(result.pipeline_stage).toBeNull();
    expect(result.root_cause_stage).toBeNull();
    expect(result.stages.find(row => row.stage === 'search_relevance').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'search_transport').status).toBe(STATUS.PASS);
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
    expect(result.failure_stage).toBe('repair_quality_gate');
    expect(result.pipeline_stage).toBe('answer_quality');
    expect(result.root_cause_stage).toBe('repair_quality_gate');
    expect(result.error_code).toBe('PERSON_IDENTITY_TOO_GENERIC');
    expect(result.stages.find(row => row.stage === 'search_transport').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'evidence').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'ai_generate').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'initial_quality_gate').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'repair_attempt').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'repair_quality_gate').status).toBe(STATUS.FAIL);
    expect(result.research_quality).toEqual(expect.objectContaining({
      initial_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
      repair_attempted:true,
      repair_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
      repair_succeeded:false
    }));
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.FAIL);
  });

  test('marks a successfully repaired answer as degraded rather than failed', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-repaired',
      path:'OPEN_CHAT_RESEARCH',
      totalMs:4200,
      loopResult:{
        ok:true,
        reply:'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.',
        failed:false,
        trace:[
          { action:'web_search', execution:{ ok:true } },
          { action:'web_explore', execution:{ ok:true } },
          { action:'evidence_verify', execution:{ ok:true } },
          { action:'research_synthesize', execution:{ ok:true } }
        ],
        research:{
          status:'completed',
          initial_quality_code:'PERSON_IDENTITY_TOO_GENERIC',
          initial_quality_ms:1,
          repair_attempted:true,
          repair_ms:600,
          repair_quality_code:'PASS',
          repair_quality_ms:1,
          repair_succeeded:true,
          decision_eligible:true,
          research_acquisition_ms:1200,
          answer_synthesis_ms:1800,
          timings:{ search_ms:200, explore_ms:300, verify_ms:100, synthesize_ms:50 }
        }
      }
    });

    expect(result.status).toBe(STATUS.DEGRADED);
    expect(result.failure_stage).toBeNull();
    expect(result.error_code).toBeNull();
    expect(result.stages.find(row => row.stage === 'initial_quality_gate').status).toBe(STATUS.DEGRADED);
    expect(result.stages.find(row => row.stage === 'repair_attempt').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'repair_quality_gate').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.PASS);
  });

  test('separates search transport from relevance and skips downstream stages on low relevance', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-low-relevance',
      path:'OPEN_CHAT_RESEARCH',
      totalMs:35000,
      loopResult:{
        ok:true,
        reply:'safe failure response',
        failed:true,
        trace:[
          { action:'web_search', execution:{ ok:true } }
        ],
        research:{
          status:'search_low_relevance',
          decision_eligible:false,
          timings:{ search_ms:3102 },
          research_acquisition_ms:8123
        }
      }
    });

    expect(result.schema_version).toBe(2);
    expect(result.status).toBe(STATUS.FAIL);
    expect(result.pipeline_stage).toBe('research_acquisition');
    expect(result.root_cause_stage).toBe('search_relevance');
    expect(result.failure_stage).toBe('search_relevance');
    expect(result.error_code).toBe('search_low_relevance');
    expect(result.stages.find(row => row.stage === 'research_acquisition').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'search_transport').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'search_relevance').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'explore').status).toBe(STATUS.SKIPPED);
    expect(result.stages.find(row => row.stage === 'evidence').status).toBe(STATUS.SKIPPED);
    expect(result.stages.find(row => row.stage === 'ai_generate').status).toBe(STATUS.SKIPPED);
    expect(result.stages.find(row => row.stage === 'initial_quality_gate').status).toBe(STATUS.SKIPPED);
    expect(result.stages.find(row => row.stage === 'repair_attempt').status).toBe(STATUS.NOT_REQUIRED);
    expect(result.stages.find(row => row.stage === 'repair_quality_gate').status).toBe(STATUS.NOT_REQUIRED);
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.FAIL);
  });

  test('does not report ai generation as pass when research metadata is absent', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-no-research',
      path:'OPEN_CHAT',
      loopResult:{
        ok:true,
        reply:'non-research answer',
        failed:false,
        trace:[],
        research:null
      }
    });

    expect(result.stages.find(row => row.stage === 'research_acquisition').status).toBe(STATUS.NOT_REQUIRED);
    expect(result.stages.find(row => row.stage === 'ai_generate').status).toBe(STATUS.NOT_AVAILABLE);
  });

  test('forces search transport failure for search_failed even without a failed trace row', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-search-failed',
      path:'OPEN_CHAT_RESEARCH',
      loopResult:{
        ok:true,
        reply:'safe failure response',
        failed:true,
        trace:[{ action:'web_search', execution:{ ok:true } }],
        research:{ status:'search_failed', decision_eligible:false, timings:{ search_ms:100 } }
      }
    });

    expect(result.pipeline_stage).toBe('research_acquisition');
    expect(result.root_cause_stage).toBe('search_transport');
    expect(result.stages.find(row => row.stage === 'search_transport').status).toBe(STATUS.FAIL);
    expect(result.stages.find(row => row.stage === 'search_relevance').status).toBe(STATUS.SKIPPED);
    expect(result.stages.find(row => row.stage === 'explore').status).toBe(STATUS.SKIPPED);
  });

  test('marks recovered exploration failure as degraded when verified research completes', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-recovered-explore',
      path:'OPEN_CHAT_RESEARCH',
      totalMs:3200,
      loopResult:{
        ok:true,
        reply:'وزارة المالية https://www.mof.gov.sa/',
        failed:false,
        trace:[
          { action:'web_search', execution:{ ok:true } },
          { action:'web_explore', execution:{ ok:false, error:{ code:'WEB_ACQUISITION_FAILED' } } },
          { action:'evidence_verify', execution:{ ok:true } },
          { action:'research_synthesize', execution:{ ok:true } }
        ],
        research:{
          status:'completed',
          initial_quality_code:'PASS',
          repair_attempted:false,
          decision_eligible:true,
          source_count:1,
          evidence_count:1,
          verification_state:'SUPPORTED',
          timings:{ search_ms:100, explore_ms:500, verify_ms:60, synthesize_ms:40 },
          research_acquisition_ms:1200,
          answer_synthesis_ms:200,
          unknowns:[],
          contradictions:[]
        }
      }
    });

    expect(result.status).toBe(STATUS.DEGRADED);
    expect(result.failure_stage).toBeNull();
    expect(result.root_cause_stage).toBeNull();
    expect(result.error_code).toBe('WEB_ACQUISITION_FAILED');
    expect(result.stages.find(row => row.stage === 'explore')).toEqual(expect.objectContaining({
      status:STATUS.DEGRADED,
      recovered:true
    }));
    expect(result.stages.find(row => row.stage === 'evidence').status).toBe(STATUS.PASS);
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.PASS);
  });

  test('marks degraded planner fallback truthfully and preserves failure reason', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-planner-degraded',
      path:'UNIVERSAL_ORCHESTRATOR',
      totalMs:22471,
      loopResult:{
        ok:true,
        reply:'تعذر الوصول إلى خدمة الذكاء حالياً. أعد المحاولة بعد قليل.',
        degraded:true,
        failure:'PLANNER_UNAVAILABLE',
        trace:[],
        nativeTelemetry:[{
          step:1,
          final:false,
          elapsed_ms:22467
        }]
      }
    });

    expect(result.status).toBe(STATUS.DEGRADED);
    expect(result.stages.find(row => row.stage === 'planner').status).toBe(STATUS.DEGRADED);
    expect(result.error_code).toBe('PLANNER_UNAVAILABLE');
    expect(result.fallback_used).toBe(true);
    expect(result.fallback_reason).toBe('PLANNER_UNAVAILABLE');
    expect(result.stages.find(row => row.stage === 'final_answer').status).toBe(STATUS.PASS);
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

  test('exposes safe research acquisition counters without raw page content', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-acquisition-trace',
      path:'OPEN_CHAT_RESEARCH',
      loopResult:{
        ok:true,
        reply:'safe failure response',
        failed:true,
        trace:[
          { action:'web_search', execution:{ ok:true } },
          { action:'web_explore', execution:{ ok:true } }
        ],
        research:{
          status:'insufficient_relevant_evidence',
          decision_eligible:false,
          source_count:0,
          evidence_count:0,
          acquisition_trace:{
            search_attempt_count:8,
            search_result_count:5,
            relevant_search_result_count:3,
            seed_count:3,
            crawl_attempted:true,
            discovered_count:3,
            visited_count:3,
            fetched_count:0,
            failed_count:2,
            blocked_count:1,
            pending_count:0,
            relevant_page_count:0,
            recovery_attempt_count:3,
            verification_attempted:false,
            verified_source_count:0,
            evidence_count:0,
            crawl_unknowns:['NO_SUCCESSFUL_ACQUISITION'],
            failure_samples:[
              {host:'example.com', status_code:403, failure_class:'HTTP_403'}
            ],
            blocked_samples:[
              {host:'blocked.example', reason:'ROBOTS_DISALLOW'}
            ]
          }
        }
      }
    });

    expect(result.acquisition_trace).toEqual(expect.objectContaining({
      search_attempt_count:8,
      search_result_count:5,
      seed_count:3,
      crawl_attempted:true,
      fetched_count:0,
      failed_count:2,
      blocked_count:1,
      relevant_page_count:0,
      verification_attempted:false,
      verified_source_count:0,
      evidence_count:0
    }));
    expect(result.acquisition_trace.failure_samples[0]).toEqual({
      host:'example.com',
      status_code:403,
      failure_class:'HTTP_403'
    });
    expect(JSON.stringify(result.acquisition_trace)).not.toContain('PRIVATE PAGE TEXT');
    expect(JSON.stringify(result.acquisition_trace)).not.toContain('https://example.com/private/path');
  });

  test('native telemetry diagnostics are whitelist-only, bounded, and rounded', () => {
    const rows = sanitizeNativeTelemetryRows([{
      step:1,
      final:false,
      lock_wait_seconds:9.87654,
      generation_seconds:2.12345,
      request_total_seconds:12.00049,
      model_load_seconds:0,
      model_cache_hit:true,
      completion_tokens:31,
      prompt_tokens:6144,
      tokens_per_second:14.98765,
      n_ctx:4096,
      finish_reason:'stop',
      native_node:'native-1',
      elapsed_ms:12001.7,
      model_path:'C:/private/model.gguf',
      prompt:'PRIVATE PROMPT',
      secret:'DO_NOT_EXPOSE'
    }]);

    expect(rows).toEqual([{
      step:1,
      final:false,
      lock_wait_seconds:9.877,
      generation_seconds:2.123,
      request_total_seconds:12,
      model_load_seconds:0,
      model_cache_hit:true,
      completion_tokens:31,
      prompt_tokens:6144,
      tokens_per_second:14.988,
      n_ctx:4096,
      finish_reason:'stop',
      native_node:'native-1',
      elapsed_ms:12002
    }]);
    expect(JSON.stringify(rows)).not.toContain('model.gguf');
    expect(JSON.stringify(rows)).not.toContain('PRIVATE PROMPT');
    expect(JSON.stringify(rows)).not.toContain('DO_NOT_EXPOSE');

    const diagnostics = buildRequestDiagnostics({
      requestId:'req-native-telemetry',
      path:'UNIVERSAL_ORCHESTRATOR',
      loopResult:{
        ok:true,
        reply:'answer',
        trace:[],
        nativeTelemetry:[{
          step:1,
          final:false,
          lock_wait_seconds:9.87654,
          usage:{ prompt_tokens:999999 },
          prompt_tokens:6144,
          model_path:'C:/private/model.gguf'
        }]
      }
    });

    expect(diagnostics.native_telemetry).toEqual([{
      step:1,
      final:false,
      lock_wait_seconds:9.877,
      prompt_tokens:6144
    }]);
    expect(JSON.stringify(diagnostics.native_telemetry)).not.toContain('model_path');
    expect(JSON.stringify(diagnostics.native_telemetry)).not.toContain('usage');
  });

  test('direct native failure diagnostics expose only safe status and retry metadata', () => {
    const result = buildRequestDiagnostics({
      requestId:'req-native-failure',
      path:'NATIVE_DIRECT',
      totalMs:2500,
      nativeError:{
        code:'NATIVE_RUNTIME_HTTP_ERROR',
        elapsedMs:640,
        upstreamStatus:404,
        runtimeErrorCode:'NOT_FOUND',
        nativeNode:'native-1',
        nativeAttempts:[
          {
            node:'native-1',
            node_attempt:1,
            ok:false,
            error_code:'NATIVE_RUNTIME_HTTP_ERROR',
            runtime_error_code:'NOT_FOUND',
            http_status:404,
            failure_category:'request',
            recoverable:false,
            node_failure:false,
            prompt:'PRIVATE PROMPT',
            authorization:'Bearer SECRET',
            native_node_url:'https://private-origin.example'
          }
        ]
      }
    });

    expect(result.status).toBe(STATUS.FAIL);
    expect(result.native_failure).toEqual({
      http_status:404,
      runtime_error_code:'NOT_FOUND',
      native_node:'native-1',
      attempts:[{
        node:'native-1',
        node_attempt:1,
        ok:false,
        error_code:'NATIVE_RUNTIME_HTTP_ERROR',
        runtime_error_code:'NOT_FOUND',
        http_status:404,
        failure_category:'request',
        recoverable:false,
        node_failure:false
      }]
    });

    const serialized = JSON.stringify(result.native_failure);
    expect(serialized).not.toContain('PRIVATE PROMPT');
    expect(serialized).not.toContain('Bearer SECRET');
    expect(serialized).not.toContain('private-origin');
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
