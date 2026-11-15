'use strict';
const { isActiveEntitlement } = require('./catalog');

// Checked on *every* request by the future trusted server-to-server adapter.
// A verified mapping alone is never a Makkin access token or operational grant.
// No client-supplied tenant or external user ID participates in this decision.
function evaluateMakkinBridgeReadiness({ entitlement, tenantLink, userLink, workspaceLinkId, bondsUserId, now = new Date() }) {
  if (!workspaceLinkId || !bondsUserId || !isActiveEntitlement(entitlement, now)) {
    return { eligible: false, reason: 'ENTITLEMENT_REQUIRED' };
  }
  if (!tenantLink || tenantLink.workspace_link_id !== workspaceLinkId ||
      tenantLink.state !== 'verified' || !tenantLink.verified_at ||
      !tenantLink.verified_by || !tenantLink.makkin_tenant_id) {
    return { eligible: false, reason: 'TENANT_MAPPING_REQUIRED' };
  }
  if (!userLink || userLink.workspace_link_id !== workspaceLinkId ||
      userLink.bonds_user_id !== bondsUserId ||
      userLink.state !== 'verified' || !userLink.verified_at ||
      !userLink.verified_by || !userLink.makkin_user_id) {
    return { eligible: false, reason: 'USER_MAPPING_REQUIRED' };
  }
  // Full Makkin operations require an additional trusted, short-lived
  // session exchange validated by SCC380 itself. Not implemented here.
  return { eligible: true, reason: 'MAPPING_VERIFIED_NOT_OPERATIONAL' };
}
module.exports = { evaluateMakkinBridgeReadiness };
