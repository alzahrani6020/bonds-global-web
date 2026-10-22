'use strict';

const fs=require('fs');
const path=require('path');

const source=fs.readFileSync(
  path.join(__dirname,'../../v3/api/assistant.js'),
  'utf8'
);

describe('Assistant/Core A outcome integration',()=>{
  test('wires capability execution failures into Core B outcome bridge',()=>{
    expect(source).toContain("type:DUAL_CORE_EVENT_TYPES.CAPABILITY_FAILED");
    expect(source).toContain("error_code:'ASSISTANT_SERVICE_EXECUTION_FAILED'");
    expect(source).toContain("await publishAssistantOutcomeBestEffort({");
  });

  test('wires missing service profiles into capability.missing outcome',()=>{
    expect(source).toContain("type:DUAL_CORE_EVENT_TYPES.CAPABILITY_MISSING");
    expect(source).toContain("http_status:404");
  });

  test('keeps outcome recording best-effort instead of replacing assistant response',()=>{
    expect(source).toContain("error:{ code:'ASSISTANT_SERVICE_EXECUTION_FAILED', message:err.message }");
    expect(source).toContain("status:'not_found',service_code:serviceCode");
  });
});
