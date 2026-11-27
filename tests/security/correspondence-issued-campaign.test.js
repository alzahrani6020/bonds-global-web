'use strict';
const { randomUUID } = require('node:crypto');
const { buildIssuedCampaignPlan } = require('../../lib/api/correspondence-issued-campaign');
const TENANT = randomUUID();
const MAILBOX = { id: randomUUID(), tenantId: TENANT, verified: true, enabled: true, address: 'info@bonds-global.com' };
const contact = (email, overrides={}) => ({ id: randomUUID(), tenantId: TENANT, status:'active', canEmail:true, email, ...overrides });
const letter = (recipient, overrides={}) => ({
  documentId: randomUUID(), issuedHash:'a'.repeat(64), status:'issued',
  issueState:'active', artifactVerified:true, hasApprovedStamp:true, hasVerificationQr:true,
  documentRecipientId:recipient.id, documentRecipientEmail:recipient.email, subject:'طلب تعاون استثماري - كليكس',
  recipient, ...overrides
});
const request = (letters, overrides={}) => ({
  campaignId:randomUUID(), tenantId:TENANT, authorization:'verified-server-side',
  sendApproved:true, mailbox:MAILBOX, letters, ...overrides
});
describe('Clix issued campaign preflight - fail closed', () => {
  test('builds exactly one separate job per approved and issued investor letter', () => {
    const p = buildIssuedCampaignPlan(request([letter(contact('first@example.com')),letter(contact('second@example.com'))]));
    expect(p.count).toBe(2);
    expect(p.jobs.map(j=>j.to)).toEqual(['first@example.com','second@example.com']);
    expect(p.jobs[0].documentId).not.toBe(p.jobs[1].documentId);
    expect(p.jobs[0].from).toBe('info@bonds-global.com');
    expect(p.jobs[0].idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(p.jobs)).toBe(true);
  });
  test.each([
    [{authorization:'client-supplied'},'Server-side authorization'],
    [{sendApproved:false},'Explicit campaign'],
    [{mailbox:{...MAILBOX,verified:false}},'mailbox'],
    [{mailbox:{...MAILBOX,tenantId:randomUUID()}},'another tenant']
  ])('rejects missing authorization and mailbox assurances', (override, reason) => {
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('one@example.com'))],override))).toThrow(reason);
  });
  test.each([
    [{status:'draft'},'issued, stamped'],
    [{artifactVerified:false},'issued, stamped'],
    [{issueState:'revoked'},'issued, stamped'],
    [{hasApprovedStamp:false},'issued, stamped'],
    [{hasVerificationQr:false},'issued, stamped'],
    [{documentRecipientEmail:'other@example.com'},'does not match'],
    [{documentRecipientId:randomUUID()},'does not match']
  ])('rejects unverified or incorrectly addressed issued letters', (override,reason) => {
    const c=contact('one@example.com');
    expect(()=>buildIssuedCampaignPlan(request([letter(c,override)]))).toThrow(reason);
  });
  test('rejects duplicate recipients even across distinct letter ids',()=>{
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('one@example.com')),letter(contact('ONE@example.com'))]))).toThrow('Duplicate campaign recipient');
  });
  test('rejects document reuse across recipients',()=>{
    const docId=randomUUID();
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('one@example.com'),{documentId:docId}),letter(contact('two@example.com'),{documentId:docId})]))).toThrow('One issued document');
  });
  test('rejects another tenant contact',()=>{
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('one@example.com',{tenantId:randomUUID()}))]))).toThrow('another tenant');
  });
  test('rejects header injection in addresses and subjects',()=>{
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('a@example.com\\nBcc:other@example.com'))]))).toThrow();
    expect(()=>buildIssuedCampaignPlan(request([letter(contact('a@example.com'),{subject:'hello\\r\\nBcc: other'})]))).toThrow();
  });
  test('no mail provider, database or queue dependency is imported',()=>{
    const src=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../lib/api/correspondence-issued-campaign.js'),'utf8');
    expect(src).not.toMatch(/sendEmail|fetch\\(|supabase|process\\.env/);
  });
});
