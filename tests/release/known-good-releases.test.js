'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const { createKnownGoodRelease,selectKnownGoodRelease }=require('../../lib/release/known-good-releases');

const SHA='013cef79f136883d634e013375cd8d2a11a73907';

function verified(overrides={}){
  return {
    verification_id:'prod-'+'a'.repeat(24),
    status:'production_verified',
    state:STATES.VERIFIED,
    production_sha:SHA,
    checks:[
      {id:'health',passed:true,code:'OK'},
      {id:'readiness',passed:true,code:'OK'},
      {id:'smoke',passed:true,code:'OK'}
    ],
    policy:{known_good_eligible:true},
    ...overrides
  };
}

describe('Phase 5 known-good releases',()=>{
  test('creates immutable known-good evidence only from production verified release',()=>{
    const r=createKnownGoodRelease({
      productionVerification:verified(),
      releaseSha:SHA,
      metadata:{label:'prod'}
    });
    expect(r.status).toBe('known_good');
    expect(r.state).toBe(STATES.VERIFIED);
    expect(r.release_sha).toBe(SHA);
    expect(r.policy).toEqual(expect.objectContaining({
      immutable_evidence:true,
      exact_sha_required:true,
      verified_only:true,
      rollback_source_eligible:true,
      auto_rollback:false,
      auto_deploy:false
    }));
  });

  test('rejects non verified production evidence',()=>{
    expect(()=>createKnownGoodRelease({
      productionVerification:verified({status:'blocked',state:STATES.BLOCKED}),
      releaseSha:SHA
    })).toThrow('KNOWN_GOOD_PRODUCTION_NOT_VERIFIED');
  });

  test('rejects mismatched SHA',()=>{
    expect(()=>createKnownGoodRelease({
      productionVerification:verified(),
      releaseSha:'1'.repeat(40)
    })).toThrow('KNOWN_GOOD_SHA_MISMATCH');
  });

  test('rejects any failed production check',()=>{
    expect(()=>createKnownGoodRelease({
      productionVerification:verified({
        checks:[{id:'smoke',passed:false,code:'SMOKE_FAILED'}]
      }),
      releaseSha:SHA
    })).toThrow('KNOWN_GOOD_FAILED_CHECK_PRESENT');
  });

  test('selects only eligible verified rollback source',()=>{
    const good=createKnownGoodRelease({
      productionVerification:verified(),
      releaseSha:SHA
    });
    const bad={...good,known_good_id:'known-good-z'.padEnd(35,'z'),status:'blocked'};
    expect(selectKnownGoodRelease({releases:[bad,good]})).toEqual(good);
  });

  test('can exclude current SHA when selecting rollback source',()=>{
    const good=createKnownGoodRelease({
      productionVerification:verified(),
      releaseSha:SHA
    });
    expect(selectKnownGoodRelease({releases:[good],excludeSha:SHA})).toBeNull();
  });
});
