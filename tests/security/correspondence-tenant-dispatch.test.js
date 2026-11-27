'use strict';
const { buildTenantDispatchPlan, emailAddress } = require('../../lib/api/correspondence-tenant-dispatch');
const tenantA = '12345678-1234-4123-8123-1234567890ab';
const tenantB = '22345678-1234-4123-8123-1234567890ab';
const contactA = '32345678-1234-4123-8123-1234567890ab';
const contactB = '42345678-1234-4123-8123-1234567890ab';
const doc = '52345678-1234-4123-8123-1234567890ab';
const hash = 'a'.repeat(64);
const base = () => ({
  tenantId:tenantA, authorization:'verified-server-side',
  mailbox:{tenantId:tenantA,id:'zoho-account-a',address:'info@bonds-global.com',verified:true,enabled:true},
  recipients:[
    {tenantId:tenantA,id:contactA,email:'partner@example.org',status:'active',canEmail:true},
    {tenantId:tenantA,id:contactB,email:'partner2@example.org',status:'active',canEmail:true}
  ],
  documentId:doc,issuedHash:hash,subject:'Official correspondence'
});

describe('tenant-safe correspondence individual dispatch planner (no real mail)', () => {
  test('one isolated envelope per contact without cc/bcc or shared address book', () => {
    const plan=buildTenantDispatchPlan(base());
    expect(plan.count).toBe(2);
    expect(plan.jobs).toHaveLength(2);
    for(const job of plan.jobs) {
      expect(job.tenantId).toBe(tenantA);
      expect(job.from).toBe('info@bonds-global.com');
      expect(Object.hasOwn(job,'cc')).toBe(false);
      expect(Object.hasOwn(job,'bcc')).toBe(false);
      expect(Object.hasOwn(job,'recipients')).toBe(false);
      expect(Object.hasOwn(job,'contacts')).toBe(false);
    }
    expect(plan.jobs[0].to).toBe('partner@example.org');
    expect(plan.jobs[1].to).toBe('partner2@example.org');
    expect(plan.jobs[0].idempotencyKey).not.toBe(plan.jobs[1].idempotencyKey);
    expect(buildTenantDispatchPlan(base()).jobs[0].idempotencyKey).toBe(plan.jobs[0].idempotencyKey);
  });
  test('rejects a mailbox from a different company', () => {
    const x=base();x.mailbox.tenantId=tenantB;
    expect(()=>buildTenantDispatchPlan(x)).toThrow('another tenant');
  });
  test('rejects a contact from a different company', () => {
    const x=base();x.recipients[1].tenantId=tenantB;
    expect(()=>buildTenantDispatchPlan(x)).toThrow('another tenant');
  });
  test('rejects unverified mailbox, missing permission or contact consent', () => {
    const x=base();delete x.authorization;expect(()=>buildTenantDispatchPlan(x)).toThrow('authorization');
    const y=base();y.mailbox.verified=false;expect(()=>buildTenantDispatchPlan(y)).toThrow('not verified');
    const z=base();z.recipients[0].canEmail=false;expect(()=>buildTenantDispatchPlan(z)).toThrow('not authorized');
  });
  test('refuses extra header fields and multi-recipient injection', () => {
    const x=base();x.cc='other@example.com';expect(()=>buildTenantDispatchPlan(x)).toThrow('must be resolved');
    const y=base();y.recipients[0].email='partner@example.org,other@example.org';expect(()=>buildTenantDispatchPlan(y)).toThrow('Invalid');
    const z=base();z.recipients[0].email='partner@example.org\r\nBcc: victim@example.com';expect(()=>buildTenantDispatchPlan(z)).toThrow('Invalid');
    const u=base();u.subject='hello\r\nCc: someone@example.org';expect(()=>buildTenantDispatchPlan(u)).toThrow('subject');
  });
  test('rejects duplicate addresses and empty batches', () => {
    const x=base();x.recipients[1].email='PARTNER@example.org';expect(()=>buildTenantDispatchPlan(x)).toThrow('Duplicate');
    const y=base();y.recipients=[];expect(()=>buildTenantDispatchPlan(y)).toThrow('bounded');
  });
  test('rejects missing issuance proof rather than sending draft', () => {
    const x=base();x.issuedHash='';expect(()=>buildTenantDispatchPlan(x)).toThrow('hash');
    const y=base();y.documentId='bad';expect(()=>buildTenantDispatchPlan(y)).toThrow('identifier');
  });
  test('validates single mailbox format', () => {
    expect(emailAddress(' Alice@Example.com ')).toBe('alice@example.com');
    expect(()=>emailAddress('a@a.com; b@b.com')).toThrow();
  });
});
