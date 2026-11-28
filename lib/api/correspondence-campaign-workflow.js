'use strict';

// Generic correspondence campaign state machine. This is transport-neutral:
// no mail, database, OAuth or official issuance side effects.
const STATES = Object.freeze(['draft','review','approved','running','paused','completed','cancelled']);
const EVENT_TRANSITIONS = Object.freeze({
  submit: Object.freeze({ draft:'review' }),
  approve: Object.freeze({ review:'approved' }),
  return: Object.freeze({ review:'draft' }),
  start: Object.freeze({ approved:'running', paused:'running' }),
  pause: Object.freeze({ running:'paused' }),
  complete: Object.freeze({ running:'completed' }),
  cancel: Object.freeze({ draft:'cancelled', review:'cancelled', approved:'cancelled', paused:'cancelled' })
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = Object.freeze(['investment','partnership','institutional','customer','supplier','other']);
function deny(reason, status=409) { const error=new Error(reason); error.status=status; throw error; }
function campaignDefinition(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) deny('Invalid campaign',400);
  if (!UUID.test(String(input.id||'')) || !UUID.test(String(input.tenantId||''))) deny('Campaign and tenant IDs required',400);
  if (!KINDS.includes(input.kind)) deny('Unsupported campaign type',400);
  if (typeof input.title !== 'string' || input.title.trim().length<3 || input.title.length>180) deny('Campaign title is required',400);
  if (input.status !== 'draft') deny('New campaign must start as draft',409);
  return Object.freeze({ id:input.id.toLowerCase(), tenantId:input.tenantId.toLowerCase(), kind:input.kind,
    title:input.title.trim(), status:'draft' });
}
function transitionCampaign(campaign, event, context={}) {
  if (!campaign || !STATES.includes(campaign.status)) deny('Invalid campaign state',400);
  if (typeof event!=='string' || !Object.prototype.hasOwnProperty.call(EVENT_TRANSITIONS,event)) deny('Unknown event',400);
  if (context.authorization !== 'verified-server-side') deny('Server-side authorization required',403);
  if (context.actorTenantId !== campaign.tenantId || !UUID.test(String(context.actorId||''))) deny('Cross-tenant or missing actor',403);
  const next=EVENT_TRANSITIONS[event][campaign.status];
  if (!next) deny('Invalid campaign transition',409);
  if (event==='approve' && context.canApprove!==true) deny('Campaign approval permission required',403);
  if (event==='start' && (context.canSend!==true || context.mailboxVerified!==true ||
      context.lettersValidated!==true || context.dispatchApproval!==true)) {
    deny('Sender, recipient, document and explicit dispatch approval gates are required',403);
  }
  if (event==='complete' && context.pendingJobs!==0) deny('Cannot complete with pending jobs',409);
  return Object.freeze({ ...campaign, status:next });
}
module.exports={ STATES,KINDS,campaignDefinition,transitionCampaign };
