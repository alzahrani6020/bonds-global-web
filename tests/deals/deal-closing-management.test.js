'use strict';

const fs=require('fs');
const path=require('path');
const {Readable}=require('stream');
const {createFakeSupabase}=require('./fake-supabase');
const {dealsRouter}=require('../../v3/api/deals');
const {buildDealLifecycleContext}=require('../../lib/deals/deal-access');
const {GateEngine}=require('../../lib/enterprise-lifecycle/gate-engine');
const {normalizeClosingRecordCreate}=require('../../lib/deals/deal-closing');

const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const definition=JSON.parse(read('lib/enterprise-lifecycle/definitions/project-investment-lifecycle.json'));
const OWNER={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'};
const INVESTOR={id:'22222222-2222-4222-8222-222222222222',email:'investor@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'};

function req(method,body){const r=Readable.from(body===undefined?[]:[JSON.stringify(body)]);r.method=method;r.headers={};return r}
async function call(supabase,user,method,route,body){
  const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=v?JSON.parse(v):null}};
  await dealsRouter(req(method,body),res,route,supabase,user);return res;
}
function seed(){return createFakeSupabase({funding_cases:[],enterprise_lifecycle_instances:[],bonds_projects:[]})}
async function createDeal(s){const r=await call(s,OWNER,'POST','/deals',{title:'Closing test',deal_type:'investment'});expect(r.statusCode).toBe(201);return r.body.deal}
async function makeAcceptedTermSheet(s,deal){
  const party=(await call(s,OWNER,'POST',`/deals/${deal.id}/parties`,{name:'Fund Alpha',party_role:'investor'})).body.party;
  const pipe=(await call(s,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:party.id,kind:'investor'})).body.pipeline_entry;
  const offer=(await call(s,OWNER,'POST',`/deals/${deal.id}/offers`,{pipeline_entry_id:pipe.id,offer_type:'term_sheet',amount:10000000,currency:'SAR',valuation:50000000,equity_percent:20})).body.offer;
  const accepted=await call(s,OWNER,'PATCH',`/deals/${deal.id}/offers/${offer.id}`,{status:'accepted'});
  expect(accepted.statusCode).toBe(200);
  return accepted.body.offer;
}

describe('F.4 closing migration',()=>{
  const sql=read('supabase/migrations/20261112143000_deal_closing_management.sql');
  test('is additive and keeps closing data in canonical deal workspace',()=>{
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_closing_items/i);
    expect(sql).toMatch(/create table if not exists public\.bonds_deal_closing_records/i);
    expect(sql).toMatch(/references public\.bonds_deals\(id\)/i);
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });
  test('does not expose internal closing records to counterparties through RLS',()=>{
    expect(sql).toMatch(/in \('owner','advisor','external_expert'\)/);
    expect(sql).not.toMatch(/grant\s+(insert|update)[^;]*to authenticated/i);
  });
});

describe('F.4 closing domain',()=>{
  test('enforces type-specific final statuses',()=>{
    expect(normalizeClosingRecordCreate({record_type:'term_sheet',status:'signed'})).toMatchObject({record_type:'term_sheet',status:'signed'});
    expect(()=>normalizeClosingRecordCreate({record_type:'term_sheet',status:'confirmed'})).toThrow('CLOSING_RECORD_STATUS_INVALID_FOR_TYPE');
    expect(()=>normalizeClosingRecordCreate({record_type:'cap_table',status:'signed'})).toThrow('CLOSING_RECORD_STATUS_INVALID_FOR_TYPE');
  });
});

describe('F.3 to F.4 lifecycle bridge',()=>{
  const gate=new GateEngine();
  const passed=(id,context)=>gate.evaluate({id,...definition.guardDefinitions[id]},context).passed;

  test('accepted terms open negotiation and governed evidence opens each closing guard',()=>{
    const context=buildDealLifecycleContext({
      deal:{id:'d',status:'active'},
      offers:[{id:'o1',offer_type:'term_sheet',status:'accepted',amount:100,currency:'SAR',equity_percent:20}],
      closingItems:[{id:'c1',required:true,status:'satisfied'}],
      closingRecords:[
        {id:'r1',record_type:'term_sheet',status:'signed'},
        {id:'r2',record_type:'cap_table',status:'approved'},
        {id:'r3',record_type:'funding_confirmation',status:'confirmed'}
      ]
    });
    expect(passed('guard_negotiation_terms',context)).toBe(true);
    expect(passed('guard_term_sheet_signed',context)).toBe(true);
    expect(passed('guard_cap_table_approved',context)).toBe(true);
    expect(passed('guard_funds_received',context)).toBe(true);
  });

  test('received or under-review offers do not open negotiation terms',()=>{
    const context=buildDealLifecycleContext({
      deal:{id:'d',status:'active'},
      offers:[{id:'o1',offer_type:'term_sheet',status:'under_review'}]
    });
    expect(context.negotiation).toBeUndefined();
    expect(passed('guard_negotiation_terms',context)).toBe(false);
  });
});

describe('F.4 router sequence',()=>{
  test('requires accepted term sheet, cap-table approval, and completed CPs before funds confirmation',async()=>{
    const s=seed();const deal=await createDeal(s);
    const offer=await makeAcceptedTermSheet(s,deal);

    const cp=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-items`,{title:'Board approval',category:'corporate',required:true});
    expect(cp.statusCode).toBe(201);

    const term=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'term_sheet',status:'signed',offer_id:offer.id,reference:'TS-1'});
    expect(term.statusCode).toBe(201);

    const cap=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'cap_table',status:'approved',reference:'CAP-1'});
    expect(cap.statusCode).toBe(201);

    const earlyFunds=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'funding_confirmation',status:'confirmed',amount:10000000});
    expect(earlyFunds.statusCode).toBe(409);
    expect(earlyFunds.body.error).toBe('CLOSING_CONDITIONS_INCOMPLETE');

    const closeCp=await call(s,OWNER,'PATCH',`/deals/${deal.id}/closing-items/${cp.body.closing_item.id}`,{status:'satisfied'});
    expect(closeCp.statusCode).toBe(200);
    expect(closeCp.body.closing_item.satisfied_at).toBeTruthy();

    const funds=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'funding_confirmation',status:'confirmed',amount:10000000,currency:'SAR',reference:'BANK-1'});
    expect(funds.statusCode).toBe(201);

    const view=await call(s,OWNER,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.closing_items).toHaveLength(1);
    expect(view.body.workspace.closing_records).toHaveLength(3);
  });

  test('cannot sign an unaccepted term sheet or approve cap table before term-sheet signature',async()=>{
    const s=seed();const deal=await createDeal(s);
    const party=(await call(s,OWNER,'POST',`/deals/${deal.id}/parties`,{name:'Fund Beta',party_role:'investor'})).body.party;
    const pipe=(await call(s,OWNER,'POST',`/deals/${deal.id}/pipeline`,{party_id:party.id,kind:'investor'})).body.pipeline_entry;
    const offer=(await call(s,OWNER,'POST',`/deals/${deal.id}/offers`,{pipeline_entry_id:pipe.id,offer_type:'term_sheet',amount:1})).body.offer;

    const term=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'term_sheet',status:'signed',offer_id:offer.id});
    expect(term.statusCode).toBe(409);
    expect(term.body.error).toBe('CLOSING_TERM_SHEET_OFFER_NOT_ACCEPTED');

    const cap=await call(s,OWNER,'POST',`/deals/${deal.id}/closing-records`,{record_type:'cap_table',status:'approved'});
    expect(cap.statusCode).toBe(409);
    expect(cap.body.error).toBe('CLOSING_TERM_SHEET_NOT_SIGNED');
  });

  test('counterparty never receives internal closing checklist or competing closing evidence',async()=>{
    const s=seed();const deal=await createDeal(s);
    await call(s,OWNER,'POST',`/deals/${deal.id}/closing-items`,{title:'Legal opinion'});
    const invited=await call(s,OWNER,'POST',`/deals/${deal.id}/members`,{email:INVESTOR.email,side:'counterparty',member_role:'investor_rep'});
    await call(s,INVESTOR,'GET','/deals');
    await call(s,OWNER,'POST',`/deals/${deal.id}/members/${invited.body.member.id}/nda`,{nda_status:'signed'});
    const view=await call(s,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.statusCode).toBe(200);
    expect(view.body.workspace.closing_items).toEqual([]);
    expect(view.body.workspace.closing_records).toEqual([]);
    const forbidden=await call(s,INVESTOR,'POST',`/deals/${deal.id}/closing-items`,{title:'x'});
    expect(forbidden.statusCode).toBe(403);
  });
});
