'use strict';

const DEFAULT_TTL_MS = 5000;
const MAX_ENTRIES = 16;
const CACHEABLE_KEYS = new Set(['assistant_safe_introspection']);

const cache = new Map();

function boundedTtl(value){
  const n=Number.parseInt(String(value??''),10);
  if(!Number.isFinite(n))return DEFAULT_TTL_MS;
  return Math.min(30000,Math.max(1000,n));
}

function clone(value){
  return value===undefined?undefined:JSON.parse(JSON.stringify(value));
}

function sanitizeIntrospectionSnapshot(snapshot={}){
  const actionTypes=Array.isArray(snapshot.action_types)?snapshot.action_types.map(String).slice(0,100):[];
  return {
    protocol:String(snapshot.protocol||'BONDS_ASSISTANT_PROTOCOL_V1').slice(0,100),
    protocol_version:Number.isInteger(snapshot.protocol_version)?snapshot.protocol_version:1,
    navigation_schema_version:Number.isInteger(snapshot.navigation_schema_version)?snapshot.navigation_schema_version:null,
    form_schema_version:Number.isInteger(snapshot.form_schema_version)?snapshot.form_schema_version:null,
    navigation_targets:Math.max(0,Number(snapshot.navigation_targets)||0),
    registered_forms:Math.max(0,Number(snapshot.registered_forms)||0),
    action_types:actionTypes,
    emergency_mode:{
      mode:String(snapshot.emergency_mode?.mode||'unknown').slice(0,64),
      disabled:snapshot.emergency_mode?.disabled===true,
      feature:snapshot.emergency_mode?.feature?String(snapshot.emergency_mode.feature).slice(0,100):null,
      expires_at:snapshot.emergency_mode?.expires_at||null
    },
    policy:{
      informational_only:true,
      authorization_source:false,
      execution_authorized:false,
      auto_execute:false,
      contains_user_data:false,
      contains_secrets:false
    }
  };
}

function evictExpired(nowMs=Date.now()){
  for(const [key,item] of cache.entries()){
    if(!item || item.expires_at_ms<=nowMs)cache.delete(key);
  }
}

function enforceBound(){
  while(cache.size>MAX_ENTRIES){
    const oldest=cache.keys().next().value;
    cache.delete(oldest);
  }
}

async function getCachedIntrospection({
  key='assistant_safe_introspection',
  ttlMs=DEFAULT_TTL_MS,
  nowMs=Date.now(),
  loader
}={}){
  if(!CACHEABLE_KEYS.has(key))throw new Error('INTROSPECTION_CACHE_KEY_INVALID');
  if(typeof loader!=='function')throw new Error('INTROSPECTION_CACHE_LOADER_REQUIRED');

  evictExpired(nowMs);
  const cached=cache.get(key);
  if(cached && cached.expires_at_ms>nowMs){
    return {
      snapshot:clone(cached.snapshot),
      cache:{
        hit:true,
        age_ms:Math.max(0,nowMs-cached.created_at_ms),
        ttl_ms:cached.ttl_ms
      }
    };
  }

  const loaded=await loader();
  const snapshot=sanitizeIntrospectionSnapshot(loaded);
  const ttl=boundedTtl(ttlMs);
  cache.set(key,{
    snapshot:clone(snapshot),
    created_at_ms:nowMs,
    expires_at_ms:nowMs+ttl,
    ttl_ms:ttl
  });
  enforceBound();

  return {
    snapshot:clone(snapshot),
    cache:{
      hit:false,
      age_ms:0,
      ttl_ms:ttl
    }
  };
}

function clearSafeIntrospectionCache(){
  cache.clear();
}

function safeIntrospectionCacheStats(nowMs=Date.now()){
  evictExpired(nowMs);
  return {
    entries:cache.size,
    max_entries:MAX_ENTRIES,
    keys:[...cache.keys()]
  };
}

module.exports={
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  CACHEABLE_KEYS,
  boundedTtl,
  sanitizeIntrospectionSnapshot,
  getCachedIntrospection,
  clearSafeIntrospectionCache,
  safeIntrospectionCacheStats
};
