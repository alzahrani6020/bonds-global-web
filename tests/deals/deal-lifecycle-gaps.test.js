'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createFakeSupabase } = require('./fake-supabase');
const { dealsRouter } = require('../../v3/api/deals');
const {
  buildDealLifecycleContext,
  normalizeMemberInvite,
  normalizeMemberPatch,
  can
} = require('../../lib/deals/deal-access');
const { DealContextAdapter } = require('../../lib/enterprise-lifecycle/integrations/deal-context-adapter');
const { GateEngine } = require('../../lib/enterprise-lifecycle/gate-engine');
const { deriveNextBestAction } = require('../../lib/ecc/project-status-aggregator');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const definition = JSON.parse(read('lib/enterprise-lifecycle/definitions/project-investment-lifecycle.json'));

const OWNER = { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
const INVESTOR = { id: '22222222-2222-4222-8222-222222222222', email: 'investor@fund.example', email_confirmed_at: '2026-01-01T00:00:00Z' };
const ANALYST = { id: '33333333-3333-4333-8333-333333333333', email: 'analyst@bonds.example', email_confirmed_at: '2026-01-01T00:00:00Z' };
const MANAGER = { id: '44444444-4444-4444-8444-444444444444', email: 'manager@bonds.example', email_confirmed_at: '2026-01-01T00:00:00Z' };
const STRANGER = { id: '55555555-5555-4555-8555-555555555555', email: 'stranger@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };
const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_PROJECT_ID = '77777777-7777-4777-8777-777777777777';
const INSTANCE_ID = '88888888-8888-4888-8888-888888888888';

function request(method, body) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.headers = {};
  return req;
}

async function call(supabase, user, method, route, body) {
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; }
  };
  await dealsRouter(request(method, body), res, route, supabase, user);
  return res;
}

function seed() {
  return createFakeSupabase({
    bonds_projects: [
      { id: PROJECT_ID, user_id: OWNER.id, name: 'Water plant' },
      { id: OTHER_PROJECT_ID, user_id: STRANGER.id, name: 'Not yours' }
    ],
    enterprise_lifecycle_instances: [
      { id: INSTANCE_ID, entity_type: 'project', entity_id: PROJECT_ID, status: 'active', created_at: '2026-01-01T00:00:00Z' }
    ],
    funding_cases: []
  });
}

async function createLinkedDeal(supabase) {
  const res = await call(supabase, OWNER, 'POST', '/deals', { title: 'Series A', deal_type: 'investment', project_id: PROJECT_ID });
  expect(res.statusCode).toBe(201);
  return res.body.deal;
}

async function join(supabase, user, side, memberRole) {
  const deal = supabase.db.tables.bonds_deals[0];
  const invited = await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members`, { email: user.email, side, member_role: memberRole });
  expect(invited.statusCode).toBe(201);
  const list = await call(supabase, user, 'GET', '/deals');
  expect(list.statusCode).toBe(200);
  return invited.body.member;
}

describe('deal workspace gaps — migration safety', () => {
  const sql = read('supabase/migrations/20261112100000_deal_workspace_members_lifecycle.sql');

  test('is additive and never drops, truncates or deletes data', () => {
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/grant[^;]*\bdelete\b/i);
    expect(sql).toMatch(/add column if not exists project_id/i);
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_members/i);
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_events/i);
  });

  test('enables RLS and keeps events append-only', () => {
    expect(sql).toMatch(/alter table public\.bonds_deal_members enable row level security/i);
    expect(sql).toMatch(/alter table public\.bonds_deal_events enable row level security/i);
    expect(sql).toMatch(/before update or delete on public\.bonds_deal_events/i);
    expect(sql).toMatch(/security definer/i);
  });

  test('does not modify the already-applied foundation migration', () => {
    const foundation = read('supabase/migrations/20261112003000_deal_workspace_foundation.sql');
    expect(foundation).not.toMatch(/bonds_deal_members/);
  });
});

describe('deal-access normalizers and permissions', () => {
  test('counterparties cannot be deal managers and default to a pending NDA', () => {
    expect(() => normalizeMemberInvite({ email: 'x@y.co', side: 'counterparty', member_role: 'deal_manager' })).toThrow('MEMBER_ROLE_NOT_ALLOWED_FOR_COUNTERPARTY');
    expect(normalizeMemberInvite({ email: 'X@Y.co', side: 'counterparty', member_role: 'investor_rep' })).toMatchObject({ email: 'x@y.co', nda_status: 'pending' });
    expect(() => normalizeMemberInvite({ email: 'not-an-email' })).toThrow('MEMBER_EMAIL_INVALID');
  });

  test('a pending invitation cannot be force-activated', () => {
    expect(() => normalizeMemberPatch({ status: 'active' }, { side: 'advisor', user_id: null })).toThrow('MEMBER_NOT_YET_JOINED');
  });

  test('counterparty workspace access requires a signed NDA and never grants edit rights', () => {
    const member = { side: 'counterparty', member_role: 'investor_rep', status: 'active', user_id: 'u', nda_status: 'pending' };
    expect(can({ mode: 'member', member }, 'view_workspace')).toBe(false);
    member.nda_status = 'signed';
    expect(can({ mode: 'member', member }, 'view_workspace')).toBe(true);
    expect(can({ mode: 'member', member }, 'edit_workspace')).toBe(false);
    expect(can({ mode: 'member', member }, 'view_events')).toBe(false);
  });

  test('expired members lose access', () => {
    const member = { side: 'advisor', member_role: 'analyst', status: 'active', user_id: 'u', access_expires_at: '2000-01-01T00:00:00Z' };
    expect(can({ mode: 'member', member }, 'view_workspace')).toBe(false);
  });
});

describe('deals router — shared access', () => {
  test('existing owner flow keeps working and gains access metadata', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    expect(deal.project_id).toBe(PROJECT_ID);
    expect(deal.lifecycle_instance_id).toBe(INSTANCE_ID);

    const res = await call(supabase, OWNER, 'GET', `/deals/${deal.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.access.mode).toBe('owner');
    expect(res.body.workspace).toEqual({ parties: [], tasks: [], due_diligence: [], documents: [], document_requests: [] });

    const events = supabase.db.tables.bonds_deal_events.map(e => e.event_type);
    expect(events).toEqual(expect.arrayContaining(['deal_created', 'deal_linked']));
  });

  test('linking a project owned by someone else is refused without breaking creation', async () => {
    const supabase = seed();
    const res = await call(supabase, OWNER, 'POST', '/deals', { title: 'Bad link', project_id: OTHER_PROJECT_ID });
    expect(res.statusCode).toBe(201);
    expect(res.body.link_warning).toBe('PROJECT_NOT_FOUND');
    expect(res.body.deal.project_id).toBeNull();
  });

  test('unauthenticated and unrelated users are rejected', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    expect((await call(supabase, null, 'GET', '/deals')).statusCode).toBe(401);
    expect((await call(supabase, STRANGER, 'GET', `/deals/${deal.id}`)).statusCode).toBe(404);
    expect((await call(supabase, STRANGER, 'POST', `/deals/${deal.id}/members`, { email: 'a@b.co' })).statusCode).toBe(404);
  });

  test('invitations only bind to a confirmed email', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members`, { email: INVESTOR.email, side: 'counterparty', member_role: 'investor_rep' });
    const unconfirmed = { ...INVESTOR, email_confirmed_at: null };
    const before = await call(supabase, unconfirmed, 'GET', '/deals');
    expect(before.body.shared_deals).toEqual([]);
    const after = await call(supabase, INVESTOR, 'GET', '/deals');
    expect(after.body.shared_deals.map(d => d.id)).toEqual([deal.id]);
    expect(after.body.shared_deals[0]).not.toHaveProperty('user_id');
  });

  test('duplicate invitations are rejected', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    const body = { email: INVESTOR.email, side: 'counterparty', member_role: 'viewer' };
    expect((await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members`, body)).statusCode).toBe(201);
    expect((await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members`, body)).statusCode).toBe(409);
  });

  test('counterparty sees nothing before NDA and only non-restricted documents after it', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    await call(supabase, OWNER, 'POST', `/deals/${deal.id}/parties`, { name: 'Founder', party_role: 'client' });
    const teaser = await call(supabase, OWNER, 'POST', `/deals/${deal.id}/documents`, { name: 'Teaser', category: 'marketing', confidentiality: 'standard' });
    await call(supabase, OWNER, 'PATCH', `/deals/${deal.id}/documents/${teaser.body.document.id}`, { visibility: 'counterparty' });
    await call(supabase, OWNER, 'POST', `/deals/${deal.id}/documents`, { name: 'Board minutes', category: 'legal', confidentiality: 'restricted' });
    const member = await join(supabase, INVESTOR, 'counterparty', 'investor_rep');

    const beforeNda = await call(supabase, INVESTOR, 'GET', `/deals/${deal.id}`);
    expect(beforeNda.statusCode).toBe(200);
    expect(beforeNda.body.access.mode).toBe('member');
    expect(beforeNda.body.workspace.documents).toEqual([]);
    expect(beforeNda.body.deal).not.toHaveProperty('metadata');

    const nda = await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members/${member.id}/nda`, { nda_status: 'signed', nda_reference: 'NDA-1' });
    expect(nda.statusCode).toBe(200);
    expect(nda.body.member.nda_signed_at).toBeTruthy();

    const afterNda = await call(supabase, INVESTOR, 'GET', `/deals/${deal.id}`);
    expect(afterNda.body.workspace.documents.map(d => d.name)).toEqual(['Teaser']);
    expect(afterNda.body.workspace.parties).toEqual([]);
    expect(afterNda.body.members).toHaveLength(1);
  });

  test('counterparty cannot write, invite, link or read the audit trail', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    const member = await join(supabase, INVESTOR, 'counterparty', 'investor_rep');
    await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members/${member.id}/nda`, { nda_status: 'signed' });

    expect((await call(supabase, INVESTOR, 'POST', `/deals/${deal.id}/tasks`, { title: 'x' })).statusCode).toBe(403);
    expect((await call(supabase, INVESTOR, 'POST', `/deals/${deal.id}/members`, { email: 'friend@x.co' })).statusCode).toBe(403);
    expect((await call(supabase, INVESTOR, 'POST', `/deals/${deal.id}/link`, { project_id: null })).statusCode).toBe(403);
    expect((await call(supabase, INVESTOR, 'GET', `/deals/${deal.id}/events`)).statusCode).toBe(403);
    expect((await call(supabase, INVESTOR, 'PATCH', `/deals/${deal.id}`, { stage: 'closed' })).statusCode).toBe(404);
  });

  test('advisory analyst edits the workspace but cannot manage members', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    await join(supabase, ANALYST, 'advisor', 'analyst');
    expect((await call(supabase, ANALYST, 'POST', `/deals/${deal.id}/due-diligence`, { title: 'Audit FY25', area: 'financial' })).statusCode).toBe(201);
    expect((await call(supabase, ANALYST, 'POST', `/deals/${deal.id}/members`, { email: 'x@y.co' })).statusCode).toBe(403);
    const events = await call(supabase, ANALYST, 'GET', `/deals/${deal.id}/events`);
    expect(events.statusCode).toBe(200);
    expect(events.body.events.map(e => e.event_type)).toContain('due_diligence_item_created');
  });

  test('deal manager invites others but cannot change their own membership', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    const self = await join(supabase, MANAGER, 'advisor', 'deal_manager');
    expect((await call(supabase, MANAGER, 'POST', `/deals/${deal.id}/members`, { email: INVESTOR.email, side: 'counterparty', member_role: 'viewer' })).statusCode).toBe(201);
    expect((await call(supabase, MANAGER, 'PATCH', `/deals/${deal.id}/members/${self.id}`, { member_role: 'analyst' })).statusCode).toBe(403);
  });

  test('revoked and expired members lose access', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    const analyst = await join(supabase, ANALYST, 'advisor', 'analyst');
    const revoke = await call(supabase, OWNER, 'PATCH', `/deals/${deal.id}/members/${analyst.id}`, { status: 'revoked' });
    expect(revoke.statusCode).toBe(200);
    expect((await call(supabase, ANALYST, 'GET', `/deals/${deal.id}`)).statusCode).toBe(404);

    const manager = await join(supabase, MANAGER, 'advisor', 'viewer');
    supabase.db.tables.bonds_deal_members.find(m => m.id === manager.id).access_expires_at = '2000-01-01T00:00:00Z';
    expect((await call(supabase, MANAGER, 'GET', `/deals/${deal.id}`)).statusCode).toBe(404);
  });
});

describe('deal lifecycle context', () => {
  const gate = new GateEngine();
  const evaluate = (guardId, context) => gate.evaluate({ id: guardId, ...definition.guardDefinitions[guardId] }, context).passed;

  test('NDA, deal room, VDR and due-diligence gates open only on real evidence', () => {
    const deal = { id: 'd', status: 'active' };
    const empty = buildDealLifecycleContext({ deal });
    expect(evaluate('guard_deal_room_active', empty)).toBe(false);
    expect(evaluate('guard_nda_signed', empty)).toBe(false);
    expect(evaluate('guard_vdr_access', empty)).toBe(false);
    expect(evaluate('guard_due_diligence_complete', empty)).toBe(false);

    const ready = buildDealLifecycleContext({
      deal,
      members: [{ side: 'counterparty', status: 'active', user_id: 'u', nda_status: 'signed' }],
      documents: [{ id: '1', name: 'FS', status: 'approved' }],
      dueDiligence: [{ status: 'complete' }, { status: 'not_applicable' }]
    });
    expect(evaluate('guard_deal_room_active', ready)).toBe(true);
    expect(evaluate('guard_nda_signed', ready)).toBe(true);
    expect(evaluate('guard_vdr_access', ready)).toBe(true);
    expect(evaluate('guard_due_diligence_complete', ready)).toBe(true);
  });

  test('critical or blocked due-diligence items keep the gate closed', () => {
    const deal = { id: 'd', status: 'active' };
    const critical = buildDealLifecycleContext({ deal, dueDiligence: [{ status: 'complete', risk_rating: 'critical' }] });
    expect(critical.dueDiligence).toBeUndefined();
    const items = Array.from({ length: 19 }, () => ({ status: 'complete' })).concat([{ status: 'blocked' }]);
    expect(buildDealLifecycleContext({ deal, dueDiligence: items }).dueDiligence).toBeUndefined();
  });

  test('adapter merges the linked deal into the lifecycle context without dropping existing documents', async () => {
    const supabase = seed();
    const deal = await createLinkedDeal(supabase);
    const member = await join(supabase, INVESTOR, 'counterparty', 'investor_rep');
    await call(supabase, OWNER, 'POST', `/deals/${deal.id}/members/${member.id}/nda`, { nda_status: 'signed' });

    const adapter = new DealContextAdapter({ supabase });
    const context = await adapter.enrich({
      instance: { entity_type: 'project', entity_id: PROJECT_ID },
      context: { documents: { investment_memorandum: { status: 'approved' } } }
    });
    expect(context.documents.investment_memorandum.status).toBe('approved');
    expect(context.documents.nda.status).toBe('signed');
    expect(context.documents.deal_room.status).toBe('active');
    expect(context.deal.deal_number).toBe(deal.deal_number);
  });

  test('adapter is a no-op for non-project instances and projects without deals', async () => {
    const supabase = seed();
    const adapter = new DealContextAdapter({ supabase });
    const base = { a: 1 };
    expect(await adapter.enrich({ instance: { entity_type: 'asset', entity_id: PROJECT_ID }, context: base })).toBe(base);
    expect(await adapter.enrich({ instance: { entity_type: 'project', entity_id: PROJECT_ID }, context: base })).toBe(base);
  });
});

describe('ECC next best action for deal stages', () => {
  test('suggests opening a deal only when none exists and the caller may see it', () => {
    expect(deriveNextBestAction({ currentStage: 'nda' }, null, {}, null, null, null).action).toMatch(/deal workspace/i);
    expect(deriveNextBestAction({ currentStage: 'nda' }, null, {}, null, null, undefined).action).not.toMatch(/deal workspace/i);
  });

  test('guides through counterparty invitation and NDA recording', () => {
    const deal = { members: { counterparties: 0 }, gates: { nda: 'not_started' }, due_diligence: { completion: 0 } };
    expect(deriveNextBestAction({ currentStage: 'nda' }, null, {}, null, null, deal).action).toMatch(/counterparty/i);
    deal.members.counterparties = 1;
    deal.gates.nda = 'pending';
    expect(deriveNextBestAction({ currentStage: 'nda' }, null, {}, null, null, deal).action).toMatch(/NDA/);
  });
});
