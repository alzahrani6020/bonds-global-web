/** @jest-environment node */

const {
  boundedTtl,
  sanitizeIntrospectionSnapshot,
  getCachedIntrospection,
  clearSafeIntrospectionCache,
  safeIntrospectionCacheStats
}=require('../../lib/assistant/safe-introspection-cache');

describe('Safe Assistant introspection cache',()=>{
  beforeEach(()=>clearSafeIntrospectionCache());

  test('sanitizes snapshot to bounded non-sensitive fields',()=>{
    const out=sanitizeIntrospectionSnapshot({
      protocol:'BONDS_ASSISTANT_PROTOCOL_V1',
      protocol_version:1,
      navigation_schema_version:1,
      form_schema_version:1,
      navigation_targets:7,
      registered_forms:5,
      action_types:['site_navigate','form_load'],
      emergency_mode:{
        mode:'normal',
        disabled:false,
        feature:'assistant.read_only',
        expires_at:null,
        reason:'secret internal reason'
      },
      user_id:'should-not-leak',
      token:'should-not-leak'
    });
    expect(out.emergency_mode).not.toHaveProperty('reason');
    expect(out).not.toHaveProperty('user_id');
    expect(out).not.toHaveProperty('token');
    expect(out.policy).toEqual(expect.objectContaining({
      informational_only:true,
      authorization_source:false,
      execution_authorized:false,
      contains_user_data:false,
      contains_secrets:false
    }));
  });

  test('returns cached snapshot inside TTL without reloading',async()=>{
    const loader=jest.fn()
      .mockResolvedValueOnce({protocol:'P1',protocol_version:1,emergency_mode:{mode:'normal'}})
      .mockResolvedValueOnce({protocol:'P2',protocol_version:2,emergency_mode:{mode:'disabled',disabled:true}});
    const first=await getCachedIntrospection({loader,nowMs:1000,ttlMs:5000});
    const second=await getCachedIntrospection({loader,nowMs:2000,ttlMs:5000});
    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(second.snapshot.protocol).toBe('P1');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('reloads after TTL expires',async()=>{
    const loader=jest.fn()
      .mockResolvedValueOnce({protocol:'P1',protocol_version:1,emergency_mode:{mode:'normal'}})
      .mockResolvedValueOnce({protocol:'P2',protocol_version:2,emergency_mode:{mode:'normal'}});
    await getCachedIntrospection({loader,nowMs:1000,ttlMs:1000});
    const out=await getCachedIntrospection({loader,nowMs:2001,ttlMs:1000});
    expect(out.cache.hit).toBe(false);
    expect(out.snapshot.protocol).toBe('P2');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('rejects arbitrary cache keys and bounds TTL',async()=>{
    await expect(getCachedIntrospection({
      key:'user:123',
      loader:async()=>({})
    })).rejects.toThrow('INTROSPECTION_CACHE_KEY_INVALID');
    expect(boundedTtl(1)).toBe(1000);
    expect(boundedTtl(999999)).toBe(30000);
  });

  test('stats expose only safe static cache keys',async()=>{
    await getCachedIntrospection({loader:async()=>({}),nowMs:1000,ttlMs:5000});
    expect(safeIntrospectionCacheStats(2000)).toEqual({
      entries:1,
      max_entries:16,
      keys:['assistant_safe_introspection']
    });
  });
});
