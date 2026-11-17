// This suite injects a mocked server-side Supabase client. The string below is
// a non-credential test sentinel, never a production or preview secret.
const previousMockServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
beforeAll(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = 'jest-mocked-service-role-only'; });
afterAll(() => {
  if (previousMockServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousMockServiceRoleKey;
});

const crypto=require('crypto');

let mockCurrentScenario=null;

jest.mock('../../lib/api/supabase',()=>jest.fn(()=>mockCurrentScenario.sb));

const {handler}=require('../../lib/api/correspondence');

describe('Correspondence classified PDF gating (PR-G)',()=>{
  const TOKEN='a'.repeat(36);

  const pdfBytes=Buffer.from('%PDF-1.4 fake classified bytes');
  const pdfHash=crypto.createHash('sha256').update(pdfBytes).digest('hex');

  function classifiedDoc(overrides={}){
    return {
      id:'doc-1',
      owner_user_id:'owner-1',
      created_by:'owner-1',
      title:'خطاب سري',
      subject:'موضوع سري',
      status:'sent',
      language:'ar',
      confidentiality:'confidential',
      current_version:1,
      document_hash:'HASH-1',
      issued_hash:'IH-1',
      signature_hash:'SIG-1',
      stamp_hash:'STAMP-1',
      signer_name:'مستشار مالي',
      signer_title:'مدير',
      signed_at:'2026-11-14T08:00:00.000Z',
      stamped_at:'2026-11-14T08:05:00.000Z',
      sent_at:'2026-11-14T10:00:00.000Z',
      archived_at:null,
      artifact_path:'scope/doc-1/v1/final.pdf',
      artifact_hash:pdfHash,
      artifact_document_hash:'HASH-1',
      artifact_issued_hash:'IH-1',
      artifact_version:1,
      ...overrides
    };
  }

  function activeIssue(){
    return {
      id:'iss-1',
      document_id:'doc-1',
      state:'active',
      issue_version:2,
      issue_number:'BDS-2026-000001',
      verification_token:TOKEN,
      document_hash:'HASH-1',
      issued_hash:'IH-1',
      pdf_hash:pdfHash,
      signature_hash:'SIG-1',
      stamp_hash:'STAMP-1',
      issued_at:'2026-11-14T09:00:00.000Z',
      verification_count:0
    };
  }

  function makeChain(scenario,table){
    const chain={
      filters:[],
      select:jest.fn(()=>chain),
      eq:jest.fn(()=>chain),
      is:jest.fn(()=>chain),
      in:jest.fn(()=>chain),
      or:jest.fn(()=>chain),
      order:jest.fn(()=>chain),
      limit:jest.fn(()=>chain),
      range:jest.fn(()=>chain),
      update:jest.fn(()=>chain),
      insert:jest.fn(()=>Promise.resolve({data:null,error:null})),
      upsert:jest.fn(()=>Promise.resolve({data:null,error:null})),
      maybeSingle:jest.fn(()=>Promise.resolve(scenario.next(table,'maybeSingle'))),
      single:jest.fn(()=>Promise.resolve(scenario.next(table,'single'))),
      then:(resolve)=>resolve(scenario.next(table,'then'))
    };
    return chain;
  }

  function makeScenario(users={}){
    const scenario={
      results:{},
      next(table,terminal){
        const queue=scenario.results[table+':'+terminal];
        if(queue&&queue.length)return queue.shift();
        return {data:null,error:null};
      }
    };
    scenario.blob={arrayBuffer:()=>Promise.resolve(pdfBytes)};
    scenario.sb={
      auth:{getUser:jest.fn((token)=>Promise.resolve(users[token]||{data:{user:null},error:{message:'invalid token'}}))},
      from:jest.fn((table)=>makeChain(scenario,table)),
      rpc:jest.fn(()=>Promise.resolve({data:7,error:null})),
      storage:{from:jest.fn(()=>({download:jest.fn(()=>Promise.resolve({data:scenario.blob,error:null}))}))}
    };
    return scenario;
  }

  const AUTH_HEADERS={host:'localhost',authorization:'Bearer user-token'};
  const AUTH_USER={'user-token':{data:{user:{id:'user-1',email:'user@example.com',is_anonymous:false}},error:null}};

  function mockReq(overrides={}){
    return {method:'GET',headers:{host:'localhost'},query:{},body:{},url:'/api/correspondence',...overrides};
  }

  function mockRes(){
    return {
      statusCode:200,
      headers:{},
      _json:null,
      _body:null,
      status(code){this.statusCode=code;return this;},
      setHeader(key,value){this.headers[key]=value;return this;},
      json(data){this._json=data;return this;},
      send(data){this._body=data;return this;}
    };
  }

  // Mirrors the platform.js correspondence error mapping so thrown 4xx surface as responses.
  async function runCorrespondence(req,res){
    try{
      return await handler(req,res);
    }catch(err){
      const status=Number(err?.status);
      if(Number.isInteger(status)&&status>=400&&status<500){
        return res.status(status).json({error:err.message||'Correspondence request rejected'});
      }
      throw err;
    }
  }

  test('verify hands out download URLs for a public document exactly as before',async()=>{
    const scenario=makeScenario(AUTH_USER);
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null},{data:null,error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc({confidentiality:'public'}),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',headers:AUTH_HEADERS,query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.verified).toBe(true);
    expect(res._json.final_pdf_verified).toBe(true);
    expect(res._json.official_preview_url).toContain('action=official-preview');
    expect(res._json.official_pdf_url).toContain('download=1');
  });

  test('verify withholds sensitive metadata for an authorized confidential owner',async()=>{
    const scenario=makeScenario(AUTH_USER);
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null},{data:null,error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc({owner_user_id:'user-1'}),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',headers:AUTH_HEADERS,query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.verified).toBe(true);
    expect(res._json.final_pdf_verified).toBe(true);
    // Sensitive metadata is withheld; the byte endpoint itself enforces
    // per-document authorization (official-preview gates).
    expect(res._json.pdf_access_requires_login).toBe(true);
    expect(res._json.title).toBeNull();
    expect(res._json.subject).toBeNull();
    expect(res._json.signer_name).toBeNull();
    expect(res._json.signer_title).toBeNull();
    expect(String(res._json.official_preview_url)).toContain('action=official-preview');
  });

  test('verify also withholds sensitive metadata for a restricted document',async()=>{
    const scenario=makeScenario(AUTH_USER);
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null},{data:null,error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc({confidentiality:'restricted',owner_user_id:'user-1'}),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',headers:AUTH_HEADERS,query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.verified).toBe(true);
    expect(res._json.pdf_access_requires_login).toBe(true);
    expect(res._json.title).toBeNull();
    expect(res._json.subject).toBeNull();
  });


  test.each(['internal','confidential','restricted'])('private QR %s hides state and successor from unrelated accounts before audit',async confidentiality=>{
    const scenario=makeScenario(AUTH_USER);
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:{...activeIssue(),state:'revoked',revocation_reason:'PRIVATE'},error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc({confidentiality}),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',headers:AUTH_HEADERS,query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(404);
    expect(res._json).toEqual({verified:false});
    expect(scenario.sb.rpc).not.toHaveBeenCalled();
    expect(scenario.sb.storage.from).not.toHaveBeenCalled();
  });

  test('official-preview of a confidential document without a session answers 404 without touching storage',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc(),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'official-preview',token:TOKEN}}),res);
    expect(res.statusCode).toBe(404);
    expect(res._json.error).toContain('Verification issue not found');
    // The session is probed for authorization, but no bytes are touched.
    expect(scenario.sb.storage.from).not.toHaveBeenCalled();
  });

  test('official-preview of a confidential document serves the PDF to its owner session',async()=>{
    const scenario=makeScenario({
      'owner-token':{data:{user:{id:'owner-1',email:'owner@example.com'}},error:null}
    });
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc(),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'GET',
      headers:{host:'localhost',authorization:'Bearer owner-token'},
      query:{action:'official-preview',token:TOKEN}
    }),res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual(pdfBytes);
    expect(res.headers['Content-Type']).toBe('application/pdf');
  });

  test('official-preview of a confidential document serves the PDF to an admin_roles holder',async()=>{
    const scenario=makeScenario({
      'admin-token':{data:{user:{id:'admin-1',email:'admin@example.com'}},error:null}
    });
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc(),error:null}],
      'admin_roles:maybeSingle':[{data:{role:'super_admin'},error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'GET',
      headers:{host:'localhost',authorization:'Bearer admin-token'},
      query:{action:'official-preview',token:TOKEN}
    }),res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual(pdfBytes);
  });

  test('official-preview of a confidential document answers 403 for an authenticated non-owner non-admin',async()=>{
    const scenario=makeScenario({
      'user-token':{data:{user:{id:'user-2',email:'user@example.com',is_anonymous:false}},error:null}
    });
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc(),error:null}],
      'admin_roles:maybeSingle':[{data:null,error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'GET',
      headers:{host:'localhost',authorization:'Bearer user-token'},
      query:{action:'official-preview',token:TOKEN}
    }),res);
    expect(res.statusCode).toBe(403);
    expect(res._json.error).toMatch(/not authorized/i);
    expect(scenario.sb.storage.from).not.toHaveBeenCalled();
  });

  test('official-preview of a public document without a session stays publicly downloadable',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue(),error:null}],
      'correspondence_documents:maybeSingle':[{data:classifiedDoc({confidentiality:'public'}),error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'official-preview',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual(pdfBytes);
  });
});
