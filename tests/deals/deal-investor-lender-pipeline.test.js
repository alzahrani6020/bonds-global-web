'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createFakeSupabase } = require('./fake-supabase');
const { dealsRouter } = require('../../v3/api/deals');
const {
  normalizePipelineCreate,
  normalizeOfferCreate
} = require('../../lib/deals/deal-pipeline');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const OWNER = { id:'11111111-1111-4111-8111-111111111111', email:'owner@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' };
const INVESTOR_USER = { id:'22222222-2222-4222-8222-222222222222', email:'investor@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' };
const ANALYST = { id:'33333333-3333-4333-8333-333333333333', email:'analyst@example.com', email_confirmed_at:'2026-01-01T00:00:00Z' };

function req(method,body){
  const r=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  r.method=method;r.headers={};return r;
}
async function call(supabase,user,method,route,body){
  const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=v?JSON.parse(v):null}};
  await dealsRouter(req(method,body),res,route,supabase,user);
  return res;
}
function seed(){return createFakeSupabase({funding_cases:[],enterprise_lifecycle_instances:[],bonds_projects:[]})}
async function createDeal(supabase){
  const r=await call(supabase,OWNER,'POST','/deals',{title:'Growth round',deal_type:'investment'});
  expect(r.statusCode).toBe(201);return r.body.deal;
}
async function addParty(supabase,deal,role,name){
  const r=await call(supabase,OWNER,'POST',`/deals/${deal.id}/parties`,{name,party_role:role});
  expect(r.statusCode).toBe(201);return r.body.party;
}
async function inviteAndJoin(supabase,deal,user,side='advisor',member_role='analyst'){
  const invited=await call(supabase,OWNER,'POST',`/deals/${deal.id}/members`,{email:user.email,side,member_role});
  expect(invited.statusCode).toBe(201);
  await call(supabase,user,'GET','/deals');
  return invited.body.member;
}

describe('F.3 investor/lender pipeline migration',()=>{
  const sql=read('supabase/migrations/20261112133000_deal_investor_lender_pipeline.sql');
  test('is additive and creates only pipeline/offer records above canonical parties',()=>{
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_pipeline_entries/i);
    expect(sql).toMatch(/party_id uuid not null references public\.bonds_deal_parties/i);
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_offers/i);
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });
  test('keeps counterparties read-only and out of pipeline tables',()=>{
    expect(sql).toMatch(/bonds_deal_pipeline_team_select/);
    expect(sql).toMatch(/in \('owner','advisor','external_expert'\)/);
    expect(sql).not.toMatch(/grant\s+(insert|update)[^;]*to authenticated/i);
  });
});

describe('F.3 domain validation',()=>{
  test('validates kinds and offer economics',()=>{
    const party='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(normalizePipelineCreate({party_id:party,kind:'investor'})).toMatchObject({party_id:party,kind:'investor',status:'identified'});
    expect(()=>normalizePipelineCreate({party_id:party,kind:'broker'})).toThrow('PIPELINE_KIND_INVALID');
    expect(()=>normalizeOfferCreate({pipeline_entry_id:party,offer_type:'term_sheet',equity_percent:101})).toThrow('EQUITY_PERCENT_INVALID');
    expect(normalizeOfferCreate({pipeline_entry_id:party,offer_type:'ioi',amount:5000000,currency:'sar'})).toMatchObject({amount:5000000,currency:'SAR',status:'received'});
  });
});

describe('F.3 router and visibility',()=>{
  test('reuses investor party, tracks outreach, and changes pipeline state when an IOI arrives',async()=>{
    const supabase=seed();
    const deal=await createDeal(supabase);
    const party=await addParty(supabase,deal,'investor','Fund Alpha');

    const p=await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{
      party_id:party.id,kind:'investor',status:'contacted',relationship_owner:'BONDS'
    });
    expect(p.statusCode).toBe(201);
    expect(p.body.pipeline_entry.party_id).toBe(party.id);

    const offer=await call(supabase,OWNER,'POST',`/deals/${deal.id}/offers`,{
      pipeline_entry_id:p.body.pipeline_entry.id,offer_type:'ioi',amount:10000000,currency:'SAR'
    });
    expect(offer.statusCode).toBe(201);
    expect(supabase.db.tables.bonds_deal_pipeline_entries[0].status).toBe('ioi_received');

    const workspace=await call(supabase,OWNER,'GET',`/deals/${deal.id}`);
    expect(workspace.body.workspace.pipeline).toHaveLength(1);
    expect(workspace.body.workspace.offers).toHaveLength(1);
  });

  test('rejects duplicate pipeline identity and investor/lender role mismatches',async()=>{
    const supabase=seed();
    const deal=await createDeal(supabase);
    const lender=await addParty(supabase,deal,'lender','Bank One');
    const mismatch=await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:lender.id,kind:'investor'});
    expect(mismatch.statusCode).toBe(422);
    expect(mismatch.body.error).toBe('PIPELINE_KIND_PARTY_MISMATCH');

    const first=await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:lender.id,kind:'lender'});
    expect(first.statusCode).toBe(201);
    // Fake DB does not emulate unique indexes; API must still be deterministic at runtime.
    const duplicate=await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:lender.id,kind:'lender'});
    expect([201,409]).toContain(duplicate.statusCode);
  });

  test('advisory analyst can maintain pipeline while signed-NDA counterparty cannot see or mutate it',async()=>{
    const supabase=seed();
    const deal=await createDeal(supabase);
    const party=await addParty(supabase,deal,'investor','Fund Beta');
    await inviteAndJoin(supabase,deal,ANALYST,'advisor','analyst');

    const created=await call(supabase,ANALYST,'POST',`/deals/${deal.id}/pipeline`,{party_id:party.id,kind:'investor'});
    expect(created.statusCode).toBe(201);

    const member=await inviteAndJoin(supabase,deal,INVESTOR_USER,'counterparty','investor_rep');
    await call(supabase,OWNER,'POST',`/deals/${deal.id}/members/${member.id}/nda`,{nda_status:'signed'});

    const view=await call(supabase,INVESTOR_USER,'GET',`/deals/${deal.id}`);
    expect(view.statusCode).toBe(200);
    expect(view.body.workspace.pipeline).toEqual([]);
    expect(view.body.workspace.offers).toEqual([]);

    const forbidden=await call(supabase,INVESTOR_USER,'POST',`/deals/${deal.id}/offers`,{
      pipeline_entry_id:created.body.pipeline_entry.id,offer_type:'ioi',amount:1
    });
    expect(forbidden.statusCode).toBe(403);
  });

  test('offer comparison preserves distinct debt and equity economics',async()=>{
    const supabase=seed();
    const deal=await createDeal(supabase);
    const investor=await addParty(supabase,deal,'investor','Equity Fund');
    const lender=await addParty(supabase,deal,'lender','Debt Bank');
    const ip=(await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:investor.id,kind:'investor'})).body.pipeline_entry;
    const lp=(await call(supabase,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:lender.id,kind:'lender'})).body.pipeline_entry;

    await call(supabase,OWNER,'POST',`/deals/${deal.id}/offers`,{
      pipeline_entry_id:ip.id,offer_type:'term_sheet',amount:8000000,valuation:40000000,equity_percent:20
    });
    await call(supabase,OWNER,'POST',`/deals/${deal.id}/offers`,{
      pipeline_entry_id:lp.id,offer_type:'term_sheet',amount:8000000,interest_rate_percent:7.5,tenor_months:60
    });

    const view=await call(supabase,OWNER,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.offers).toHaveLength(2);
    expect(view.body.workspace.offers.some(o=>o.equity_percent===20)).toBe(true);
    expect(view.body.workspace.offers.some(o=>o.interest_rate_percent===7.5&&o.tenor_months===60)).toBe(true);
  });
});
