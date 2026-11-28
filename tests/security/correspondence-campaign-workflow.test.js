'use strict';
const {randomUUID}=require('node:crypto');
const { campaignDefinition,transitionCampaign,KINDS }=require('../../lib/api/correspondence-campaign-workflow');
const tenantId=randomUUID(),actorId=randomUUID();
const campaign=(kind='investment')=>campaignDefinition({id:randomUUID(),tenantId,kind,title:'Campaign demonstration',status:'draft'});
const authorized={authorization:'verified-server-side',actorTenantId:tenantId,actorId};
describe('Generic BONDS correspondence campaigns',()=>{
  test.each(KINDS)('supports campaign type %s',kind=>expect(campaign(kind).kind).toBe(kind));
  test('strict draft to approval to running and completion transitions',()=>{
    const draft=campaign();
    const review=transitionCampaign(draft,'submit',authorized);
    const approved=transitionCampaign(review,'approve',{...authorized,canApprove:true});
    const running=transitionCampaign(approved,'start',{...authorized,canSend:true,mailboxVerified:true,lettersValidated:true,dispatchApproval:true});
    const paused=transitionCampaign(running,'pause',authorized);
    const resumed=transitionCampaign(paused,'start',{...authorized,canSend:true,mailboxVerified:true,lettersValidated:true,dispatchApproval:true});
    expect(transitionCampaign(resumed,'complete',{...authorized,pendingJobs:0}).status).toBe('completed');
  });
  test('no browser authorization or cross tenant operation',()=>{
    expect(()=>transitionCampaign(campaign(),'submit',{...authorized,authorization:'client-supplied'})).toThrow('Server-side');
    expect(()=>transitionCampaign(campaign(),'submit',{...authorized,actorTenantId:randomUUID()})).toThrow('Cross-tenant');
  });
  test('cannot approve without explicit approver privilege',()=>{
    const review=transitionCampaign(campaign(),'submit',authorized);
    expect(()=>transitionCampaign(review,'approve',authorized)).toThrow('approval permission');
  });
  test('cannot start without all delivery gates',()=>{
    const review=transitionCampaign(campaign(),'submit',authorized);
    const approved=transitionCampaign(review,'approve',{...authorized,canApprove:true});
    const gates={...authorized,canSend:true,mailboxVerified:true,lettersValidated:true,dispatchApproval:true};
    for(const field of ['canSend','mailboxVerified','lettersValidated','dispatchApproval']) {
      expect(()=>transitionCampaign(approved,'start',{...gates,[field]:false})).toThrow('gates are required');
    }
  });
  test('cannot complete before all jobs reach terminal status',()=>{
    const review=transitionCampaign(campaign(),'submit',authorized);
    const approved=transitionCampaign(review,'approve',{...authorized,canApprove:true});
    const running=transitionCampaign(approved,'start',{...authorized,canSend:true,mailboxVerified:true,lettersValidated:true,dispatchApproval:true});
    expect(()=>transitionCampaign(running,'complete',{...authorized,pendingJobs:1})).toThrow('pending jobs');
  });
  test('cannot restart a cancelled campaign or alter an approved campaign as a draft',()=>{
    const cancelled=transitionCampaign(campaign(),'cancel',authorized);
    expect(()=>transitionCampaign(cancelled,'start',authorized)).toThrow('Invalid campaign transition');
    expect(()=>campaignDefinition({id:randomUUID(),tenantId,kind:'investment',title:'Valid title',status:'approved'})).toThrow('start as draft');
  });
});
