/** @jest-environment node */

const {
  FEATURES,
  MODES,
  switchActive,
  deriveMode,
  buildTransition,
  requiredPhrase
}=require('../../admin/assistant-control-center.js');

describe('Assistant Control Center state logic',()=>{
  test('derives normal, read-only, and full-stop with global precedence',()=>{
    expect(deriveMode([]).mode).toBe(MODES.normal);

    const readOnly=deriveMode([
      {feature:FEATURES.readOnly,disabled:true,expires_at:null,reason:'maintenance'}
    ],1000);
    expect(readOnly).toEqual(expect.objectContaining({
      mode:MODES.readOnly,
      feature:FEATURES.readOnly
    }));

    const full=deriveMode([
      {feature:FEATURES.readOnly,disabled:true,expires_at:null},
      {feature:FEATURES.global,disabled:true,expires_at:null}
    ],1000);
    expect(full).toEqual(expect.objectContaining({
      mode:MODES.fullStop,
      feature:FEATURES.global
    }));
  });

  test('invalid expiry is fail-safe active and expired switch is inactive',()=>{
    expect(switchActive({disabled:true,expires_at:'not-a-date'},1000)).toBe(true);
    expect(switchActive({disabled:true,expires_at:'1970-01-01T00:00:00.500Z'},1000)).toBe(false);
  });

  test('full stop only activates global Assistant switch',()=>{
    const ops=buildTransition(MODES.fullStop,{
      reason:'critical incident response'
    });
    expect(ops).toEqual([{
      feature:'assistant',
      disabled:true,
      reason:'critical incident response',
      expires_at:null
    }]);
  });

  test('read-only transition activates read-only before clearing global switch',()=>{
    const ops=buildTransition(MODES.readOnly,{
      reason:'investigation mode'
    });
    expect(ops[0]).toEqual(expect.objectContaining({
      feature:'assistant.read_only',
      disabled:true
    }));
    expect(ops[1]).toEqual({
      feature:'assistant',
      disabled:false,
      reason:null,
      expires_at:null
    });
  });

  test('normal transition clears read-only before global, preserving restrictive state until final step',()=>{
    const ops=buildTransition(MODES.normal);
    expect(ops).toEqual([
      {feature:'assistant.read_only',disabled:false,reason:null,expires_at:null},
      {feature:'assistant',disabled:false,reason:null,expires_at:null}
    ]);
  });

  test('restrictive modes require a reason and optional expiry must be future',()=>{
    expect(()=>buildTransition(MODES.fullStop,{reason:'short'})).toThrow('REASON_REQUIRED');
    expect(()=>buildTransition(MODES.readOnly,{reason:'short'})).toThrow('REASON_REQUIRED');
    expect(()=>buildTransition(MODES.fullStop,{
      reason:'valid operational reason',
      expiresAt:'2000-01-01T00:00:00Z'
    })).toThrow('EXPIRY_MUST_BE_FUTURE');
  });

  test('confirmation phrases are explicit',()=>{
    expect(requiredPhrase(MODES.normal)).toBe('NORMAL');
    expect(requiredPhrase(MODES.readOnly)).toBe('READ_ONLY');
    expect(requiredPhrase(MODES.fullStop)).toBe('FULL_STOP');
  });
});
