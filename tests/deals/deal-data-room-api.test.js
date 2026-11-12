'use strict';

const { Readable } = require('stream');
const { createFakeSupabase } = require('./fake-supabase');
const { dealsRouter } = require('../../v3/api/deals');

const OWNER = {
  id:'11111111-1111-4111-8111-111111111111',
  email:'owner@example.com',
  email_confirmed_at:'2026-01-01T00:00:00Z'
};
const INVESTOR = {
  id:'22222222-2222-4222-8222-222222222222',
  email:'investor@example.com',
  email_confirmed_at:'2026-01-01T00:00:00Z'
};

function request(method, body) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.headers = {};
  return req;
}

async function call(supabase, user, method, route, body) {
  const res = {
    statusCode:0,
    headers:{},
    setHeader(k,v){ this.headers[k]=v; },
    end(payload){ this.body=payload ? JSON.parse(payload) : null; }
  };
  await dealsRouter(request(method,body),res,route,supabase,user);
  return res;
}

async function createDeal(supabase) {
  const res=await call(supabase,OWNER,'POST','/deals',{title:'Secure deal',deal_type:'investment'});
  expect(res.statusCode).toBe(201);
  return res.body.deal;
}

async function addCounterparty(supabase,deal) {
  const invite=await call(supabase,OWNER,'POST',`/deals/${deal.id}/members`,{
    email:INVESTOR.email,
    side:'counterparty',
    member_role:'investor_rep'
  });
  expect(invite.statusCode).toBe(201);
  await call(supabase,INVESTOR,'GET','/deals');
  const member=supabase.db.tables.bonds_deal_members.find(row=>row.email===INVESTOR.email);
  expect(member.user_id).toBe(INVESTOR.id);
  const nda=await call(supabase,OWNER,'POST',`/deals/${deal.id}/members/${member.id}/nda`,{
    nda_status:'signed',
    nda_reference:'NDA-F2'
  });
  expect(nda.statusCode).toBe(200);
  return member;
}

describe('F.2 secure data room API',()=>{
  test('team-only document stays hidden from a signed counterparty until explicitly shared',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    await addCounterparty(supabase,deal);

    const created=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents`,{
      name:'Financial model',
      category:'finance',
      confidentiality:'confidential'
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.document.visibility).toBe('team');

    let view=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.statusCode).toBe(200);
    expect(view.body.workspace.documents).toEqual([]);

    const patched=await call(supabase,OWNER,'PATCH',`/deals/${deal.id}/documents/${created.body.document.id}`,{
      visibility:'counterparty'
    });
    expect(patched.statusCode).toBe(200);

    view=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.documents.map(row=>row.name)).toEqual(['Financial model']);
  });

  test('selected document requires an active grant and restricted still overrides a grant',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    const member=await addCounterparty(supabase,deal);

    const created=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents`,{
      name:'Selected memo',
      category:'legal',
      confidentiality:'standard'
    });
    const docId=created.body.document.id;
    await call(supabase,OWNER,'PATCH',`/deals/${deal.id}/documents/${docId}`,{visibility:'selected'});

    let view=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.documents).toEqual([]);

    const grant=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents/${docId}/grant`,{
      member_id:member.id,
      access_level:'download'
    });
    expect(grant.statusCode).toBe(200);
    view=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.documents.map(row=>row.id)).toEqual([docId]);

    await call(supabase,OWNER,'PATCH',`/deals/${deal.id}/documents/${docId}`,{confidentiality:'restricted'});
    view=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(view.body.workspace.documents).toEqual([]);
  });

  test('document request is visible only to its assigned counterparty',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    const member=await addCounterparty(supabase,deal);

    const created=await call(supabase,OWNER,'POST',`/deals/${deal.id}/requests`,{
      title:'Tax certificate',
      category:'tax',
      requested_from_member_id:member.id
    });
    expect(created.statusCode).toBe(201);

    const owner=await call(supabase,OWNER,'GET',`/deals/${deal.id}`);
    expect(owner.body.workspace.document_requests.map(row=>row.title)).toEqual(['Tax certificate']);

    const counterparty=await call(supabase,INVESTOR,'GET',`/deals/${deal.id}`);
    expect(counterparty.body.workspace.document_requests.map(row=>row.title)).toEqual(['Tax certificate']);
  });

  test('signed upload, confirmation and short-lived download complete a real version record',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    const created=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents`,{
      name:'Statements',
      category:'finance'
    });
    const documentId=created.body.document.id;

    const upload=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents/${documentId}/upload-url`,{
      file_name:'statements.pdf',
      content_type:'application/pdf',
      size_bytes:4096
    });
    expect(upload.statusCode).toBe(201);
    expect(upload.body.version.version).toBe(1);
    expect(upload.body.upload.token).toBeTruthy();

    supabase.db.storageObjects['deal-data-room'].add(upload.body.upload.path);

    const confirmed=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents/${documentId}/confirm-upload`,{
      version_id:upload.body.version.id
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.body.version.upload_status).toBe('ready');
    expect(confirmed.body.document.status).toBe('received');
    expect(confirmed.body.document.version).toBe(1);

    const download=await call(supabase,OWNER,'POST',`/deals/${deal.id}/documents/${documentId}/download-url`,{});
    expect(download.statusCode).toBe(200);
    expect(download.body.expires_in).toBe(60);
    expect(download.body.signed_url).toMatch(/^https:\/\/storage\.example\/download\//);

    const actions=(supabase.db.tables.bonds_deal_document_access_log||[]).map(row=>row.action);
    expect(actions).toEqual(expect.arrayContaining(['upload_url_created','upload_confirmed','download_url_created']));
  });

  test('counterparty can upload only the request assigned to them',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    const member=await addCounterparty(supabase,deal);
    const requestRow=await call(supabase,OWNER,'POST',`/deals/${deal.id}/requests`,{
      title:'Commercial registration',
      requested_from_member_id:member.id
    });
    const requestId=requestRow.body.request.id;

    const upload=await call(supabase,INVESTOR,'POST',`/deals/${deal.id}/requests/${requestId}/upload-url`,{
      file_name:'cr.pdf',
      content_type:'application/pdf',
      size_bytes:1200
    });
    expect(upload.statusCode).toBe(201);

    const otherRequest=await call(supabase,OWNER,'POST',`/deals/${deal.id}/requests`,{
      title:'Unassigned',
      category:'general'
    });
    const denied=await call(supabase,INVESTOR,'POST',`/deals/${deal.id}/requests/${otherRequest.body.request.id}/upload-url`,{
      file_name:'x.pdf',
      content_type:'application/pdf',
      size_bytes:100
    });
    expect(denied.statusCode).toBe(403);
  });

  test('due diligence status and risk are operationally patchable by the deal team',async()=>{
    const supabase=createFakeSupabase();
    const deal=await createDeal(supabase);
    const item=await call(supabase,OWNER,'POST',`/deals/${deal.id}/due-diligence`,{
      title:'Tax exposure',
      area:'tax'
    });
    expect(item.statusCode).toBe(201);

    const patched=await call(supabase,OWNER,'PATCH',`/deals/${deal.id}/due-diligence/${item.body.due_diligence_item.id}`,{
      status:'blocked',
      risk_rating:'critical',
      finding:'Unresolved tax exposure',
      remediation:'Obtain settlement evidence'
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.body.due_diligence_item).toMatchObject({
      status:'blocked',
      risk_rating:'critical',
      remediation:'Obtain settlement evidence'
    });
  });
});
