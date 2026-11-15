/** @jest-environment node */
'use strict';
const { evaluateMakkinBridgeReadiness } = require('../../lib/company-programs/makkin-bridge-policy');
const now = new Date('2026-11-15T12:00:00Z');
const base = {
 workspaceLinkId:'ws-a',bondsUserId:'user-a',now,
 entitlement:{program_key:'hr',status:'active',valid_from:'2026-01-01T00:00:00Z',valid_until:null},
 tenantLink:{workspace_link_id:'ws-a',state:'verified',verified_at:'2026-11-15T00:00:00Z',verified_by:'operator',makkin_tenant_id:'tenant-a'},
 userLink:{workspace_link_id:'ws-a',bonds_user_id:'user-a',state:'verified',verified_at:'2026-11-15T00:00:00Z',verified_by:'operator',makkin_user_id:'external-a'},
};
test('fully verified links are eligible for future exchange, not yet an operational login',()=>{
 expect(evaluateMakkinBridgeReadiness(base)).toEqual({eligible:true,reason:'MAPPING_VERIFIED_NOT_OPERATIONAL'});
});
test.each(['pending','suspended', 'expired','cancelled'])('denies entitlement in %s',status=>{
 expect(evaluateMakkinBridgeReadiness({...base,entitlement:{...base.entitlement,status}}).eligible).toBe(false);
});
test('denies wrong company, wrong user, absent mapping, and unverified linking operator',()=>{
 for(const change of [
  {tenantLink:{...base.tenantLink,workspace_link_id:'ws-other'}},
  {tenantLink:{...base.tenantLink,state:'pending'}},
  {tenantLink:{...base.tenantLink,verified_by:null}},
  {tenantLink:null},
  {userLink:{...base.userLink,bonds_user_id:'user-other'}},
  {userLink:{...base.userLink,workspace_link_id:'ws-other'}},
  {userLink:{...base.userLink,state:'suspended'}},
  {userLink:{...base.userLink,verified_at:null}},
  {userLink:null},
 ]) expect(evaluateMakkinBridgeReadiness({...base,...change}).eligible).toBe(false);
});
test('denies expired subscription at exact expiry boundary',()=>{
 const entitlement={...base.entitlement,valid_until:now.toISOString()};
 expect(evaluateMakkinBridgeReadiness({...base,entitlement}).reason).toBe('ENTITLEMENT_REQUIRED');
});
test('denies unknown program even with fully verified links',()=>{
 expect(evaluateMakkinBridgeReadiness({...base,entitlement:{...base.entitlement,program_key:'invented'}}).eligible).toBe(false);
});
