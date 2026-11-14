const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

let mockCurrentScenario=null;

jest.mock('../../lib/api/supabase',()=>jest.fn(()=>mockCurrentScenario.sb));

const {handler}=require('../../lib/api/correspondence');

describe('Correspondence issuance integrity boundaries',()=>{
  const api=read('lib/api/correspondence.js');
  const ui=read('components/letterhead-correspondence.js');

  test('each signed upload is create-only and has a unique issue-scoped path',()=>{
    expect(api).toContain("crypto.randomUUID(), safeRef + '.pdf'");
    expect(api).toContain("createSignedUploadUrl(path, { upsert: false })");
    expect(api).toContain("A final PDF is already bound; issued artifacts cannot be replaced");
    expect(ui).toContain("{ contentType: 'application/pdf', upsert: false }");
    expect(ui).not.toContain("{ contentType: 'application/pdf', upsert: true }");
  });

  test('finalization blocks already finalized or raced replacements',()=>{
    expect(api).toContain("Final PDF already finalized; immutable issuance cannot be replaced");
    expect(api).toContain(".is('artifact_hash', null).is('artifact_path', null)");
    expect(api).toContain("Final PDF already bound by another operation; no overwrite permitted");
    expect(api).toContain("Final PDF does not contain the issued-document integrity marker");
  });

  test('signature modal collects both required identity fields and rejects empty input locally',()=>{
    const html=read('letterhead.html');
    const router=read('api/platform.js');
    expect(html).toContain('id="corr-signer-name"');
    expect(html).toContain('id="corr-signer-title"');
    expect(ui).toContain("document.getElementById('corr-signer-name')?.value?.trim()");
    expect(ui).toContain("document.getElementById('corr-signer-title')?.value?.trim()");
    expect(ui).toContain('يجب إدخال اسم الموقّع وصفته الرسمية قبل حفظ التوقيع');
    expect(router).toContain('return await correspondence.handler(req, res)');
    expect(router).toContain('status >= 400 && status < 500');
    expect(router).toContain('return res.status(status).json({ error: err.message');
  });

  test('future issuance requires signer name and title but does not invent historical names',()=>{
    expect(api).toContain("Signer name and capacity are required before signing");
    expect(api).toContain("!doc.signer_name || !doc.signer_title");
    expect(api).toContain("issue.signature_hash === doc.signature_hash && issue.issued_hash === doc.issued_hash");
    expect(api).toContain("signer_name: (!pdfAccessRequiresLogin && issue.signature_hash");
    expect(api).toContain("signer_title: (!pdfAccessRequiresLogin && issue.signature_hash");
  });

  test('the server independently verifies historic archived PDF bytes on every preview',()=>{
    expect(api).toContain('async function loadPublicVerifiedArtifact');
    expect(api).toContain("hash !== doc.artifact_hash || hash !== issue.pdf_hash");
    expect(api).toContain("Cache-Control', 'private, no-store, max-age=0");
  });

  test('protected correspondence requires both authentication and per-document authorization before PDF bytes are fetched',()=>{
    const preview=api.slice(api.indexOf("if (action === 'official-preview')"),api.indexOf("if (action === 'qr')"));
    expect(preview).toContain("doc.confidentiality !== 'public'");
    expect(preview).toContain("const viewer = await resolveUser(req)");
    expect(preview).toContain("const viewerRole = await resolveRole(sb, viewer.id)");
    expect(preview).toContain("const viewerMemberships = await resolveMemberships(sb, viewer.id)");
    expect(preview).toContain("const viewerPermissions = await resolveCorrespondencePermissions(sb, viewer.id, viewerRole)");
    expect(preview).toContain("!canRead(doc, viewer, viewerRole, viewerMemberships, viewerPermissions)");
    expect(preview).toContain("res.status(401)");
    expect(preview).toContain("res.status(403)");
    expect(preview.indexOf("!canRead(doc, viewer, viewerRole")).toBeLessThan(preview.indexOf("await loadPublicVerifiedArtifact(sb, doc, issue)"));
  });

  test('restricted issue QR reveals only public status and authorized viewer obtains SHA-verified blob',()=>{
    const viewer=read('components/verified-pdf-viewer.js');
    for(const page of ['verify-document.html','en/verify-document.html']){
      const html=read(page);
      expect(html).toContain('pdf_access_requires_login');
      expect(html).toContain('window.BondsAuth?.getSession()');
      expect(html).toContain('encodeURIComponent(location.pathname+location.search)');
      expect(html).toContain('authorizationToken:accessToken');
      expect(html).toContain('onVerifiedBytes:protectedPdf?bytes=>');
      expect(html).toContain('URL.createObjectURL(new Blob([bytes]');
    }
    expect(api).toContain('title: pdfAccessRequiresLogin ? null : doc.title');
    expect(api).toContain('subject: pdfAccessRequiresLogin ? null : doc.subject');
    expect(api).toContain('signer_name: (!pdfAccessRequiresLogin');
    expect(viewer).toContain("if(authorizationToken)headers.Authorization='Bearer '+authorizationToken");
    expect(viewer).toContain("if(typeof onVerifiedBytes==='function')onVerifiedBytes(documentBytes)");
    expect(viewer.indexOf('actual.toLowerCase()!==expectedHash.toLowerCase()')).toBeLessThan(viewer.indexOf("onVerifiedBytes(documentBytes)"));
  });

  test('a revoked official issue stays verifiable but loses its public download URLs',()=>{
    expect(api).toContain("issue.state !== 'revoked'");
    expect(api).toContain("if (issue.state === 'revoked')");
    expect(api).toContain('status(410)');
    expect(api).toContain('This official issue has been revoked and is no longer available');
  });

  test('issuance guards the write with the observed signature and stamp hashes',()=>{
    expect(api).toContain(".eq('signature_hash', doc.signature_hash)");
    expect(api).toContain(".eq('stamp_hash', doc.stamp_hash)");
    expect(api).toContain(".is('signature_hash', null)");
    expect(api).toContain(".is('stamp_hash', null)");
    expect(api).toContain("error.code === 'PGRST116'");
    expect(api).toContain('Signature or stamp changed during issuance');
  });
});

describe('Correspondence revoked issue and issuance race behavior',()=>{
  const TOKEN='a'.repeat(36);

  const approvedDoc={
    id:'doc-1',
    owner_user_id:'owner-1',
    created_by:'owner-1',
    status:'approved',
    current_version:1,
    document_hash:'HASH-1',
    signature_hash:'SIG-1',
    stamp_hash:'STAMP-1',
    signed_by:'admin-1',
    signed_at:'2026-11-14T08:00:00.000Z',
    signer_name:'مستشار مالي',
    signer_title:'مدير',
    requires_signature:true,
    requires_stamp:true,
    direction:'outgoing',
    outgoing_number:null,
    incoming_number:null,
    reference_number:null,
    language:'ar'
  };

  function makeChain(scenario,table){
    const filters=[];
    const chain={
      filters,
      select:jest.fn(()=>chain),
      eq:jest.fn((col,val)=>{filters.push({op:'eq',col,val});return chain;}),
      is:jest.fn((col,val)=>{filters.push({op:'is',col,val});return chain;}),
      in:jest.fn(()=>chain),
      order:jest.fn(()=>chain),
      limit:jest.fn(()=>chain),
      update:jest.fn((set)=>{
        chain.updateSet=set;
        if(table==='correspondence_documents')scenario.documentUpdate=chain;
        return chain;
      }),
      insert:jest.fn(()=>chain),
      upsert:jest.fn(()=>Promise.resolve({data:null,error:null})),
      maybeSingle:jest.fn(()=>Promise.resolve(scenario.next(table,'maybeSingle'))),
      single:jest.fn(()=>Promise.resolve(scenario.next(table,'single'))),
      then:(resolve)=>resolve(scenario.next(table,'then'))
    };
    return chain;
  }

  function makeScenario(){
    const scenario={
      results:{},
      next(table,terminal){
        const queue=scenario.results[table+':'+terminal];
        if(queue&&queue.length)return queue.shift();
        return {data:null,error:null};
      }
    };
    scenario.sb={
      auth:{getUser:jest.fn((token)=>token==='valid-token'
        ?Promise.resolve({data:{user:{id:'admin-1',email:'admin@example.com'}},error:null})
        :Promise.resolve({data:{user:null},error:{message:'invalid token'}}))},
      from:jest.fn((table)=>makeChain(scenario,table)),
      rpc:jest.fn(()=>Promise.resolve({data:'BDS-2026-000001',error:null})),
      storage:{from:jest.fn(()=>({download:jest.fn(()=>Promise.resolve({data:scenario.blob,error:null}))}))}
    };
    return scenario;
  }

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

  function issueTransitionResults(doc,singleResult){
    return {
      'admin_roles:maybeSingle':[{data:{role:'super_admin'},error:null}],
      'company_members:then':[{data:[],error:null}],
      'correspondence_documents:maybeSingle':[{data:doc,error:null}],
      'correspondence_versions:then':[{data:[{version:1,checksum_sha256:'HASH-1',pages_html:[],text_content:''}],error:null}],
      'correspondence_documents:single':[singleResult]
    };
  }

  test('official-preview answers 410 for a revoked issue without touching storage',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:{
        id:'iss-1',document_id:'doc-1',state:'revoked',issue_version:2,
        issue_number:'BDS-2026-000001',verification_token:TOKEN
      },error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'official-preview',token:TOKEN}}),res);
    expect(res.statusCode).toBe(410);
    expect(res._json.error).toContain('revoked');
    expect(scenario.sb.storage.from).not.toHaveBeenCalled();
  });

  test('official-preview still serves the bound PDF for an active issue',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    const pdfBytes=Buffer.from('%PDF-1.4 fake issued bytes');
    const pdfHash=crypto.createHash('sha256').update(pdfBytes).digest('hex');
    scenario.blob={arrayBuffer:()=>Promise.resolve(pdfBytes)};
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:{
        id:'iss-1',document_id:'doc-1',state:'active',issue_version:2,
        issue_number:'BDS-2026-000001',verification_token:TOKEN,
        pdf_hash:pdfHash
      },error:null}],
      'correspondence_documents:maybeSingle':[{data:{
        id:'doc-1',current_version:1,document_hash:'HASH-1',issued_hash:'IH-1',
        artifact_path:'scope/doc-1/v1/final.pdf',artifact_hash:pdfHash,
        artifact_document_hash:'HASH-1',artifact_issued_hash:'IH-1',artifact_version:1
      },error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'official-preview',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual(pdfBytes);
    expect(res.headers['Content-Type']).toBe('application/pdf');
  });

  test('verify keeps a revoked issue verifiable with successor but withholds download URLs',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    const pdfBytes=Buffer.from('%PDF-1.4 fake issued bytes');
    const pdfHash=crypto.createHash('sha256').update(pdfBytes).digest('hex');
    const boundDoc={
      id:'doc-1',title:'خطاب',subject:'موضوع',status:'sent',language:'ar',
      current_version:1,document_hash:'HASH-1',issued_hash:'IH-1',
      signature_hash:'SIG-1',stamp_hash:'STAMP-1',
      signer_name:'مستشار مالي',signer_title:'مدير',
      signed_at:'2026-11-14T08:00:00.000Z',stamped_at:'2026-11-14T08:05:00.000Z',
      sent_at:'2026-11-14T10:00:00.000Z',archived_at:null,
      artifact_path:'scope/doc-1/v1/final.pdf',artifact_hash:pdfHash,
      artifact_document_hash:'HASH-1',artifact_issued_hash:'IH-1',artifact_version:1
    };
    const revokedIssue={
      id:'iss-1',document_id:'doc-1',state:'revoked',issue_version:2,
      issue_number:'BDS-2026-000001',verification_token:TOKEN,
      document_hash:'HASH-1',issued_hash:'IH-1',pdf_hash:pdfHash,
      signature_hash:'SIG-1',stamp_hash:'STAMP-1',
      issued_at:'2026-11-14T09:00:00.000Z',revocation_reason:'Withdrawn by issuer',
      verification_count:3
    };
    const successor={issue_number:'BDS-2026-000002',issue_version:3,verification_token:'b'.repeat(36)};
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:revokedIssue,error:null},{data:successor,error:null}],
      'correspondence_documents:maybeSingle':[{data:boundDoc,error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.verified).toBe(true);
    expect(res._json.issue_state).toBe('revoked');
    expect(res._json.final_pdf_verified).toBe(true);
    expect(res._json.official_preview_url).toBeNull();
    expect(res._json.official_pdf_url).toBeNull();
    expect(res._json.successor).toEqual(successor);
  });

  test('verify still hands out download URLs for an active issue',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    const pdfBytes=Buffer.from('%PDF-1.4 fake issued bytes');
    const pdfHash=crypto.createHash('sha256').update(pdfBytes).digest('hex');
    const boundDoc={
      id:'doc-1',title:'خطاب',subject:'موضوع',status:'sent',language:'ar',
      current_version:1,document_hash:'HASH-1',issued_hash:'IH-1',
      signature_hash:'SIG-1',stamp_hash:'STAMP-1',
      signer_name:'مستشار مالي',signer_title:'مدير',
      signed_at:'2026-11-14T08:00:00.000Z',stamped_at:'2026-11-14T08:05:00.000Z',
      sent_at:'2026-11-14T10:00:00.000Z',archived_at:null,
      artifact_path:'scope/doc-1/v1/final.pdf',artifact_hash:pdfHash,
      artifact_document_hash:'HASH-1',artifact_issued_hash:'IH-1',artifact_version:1
    };
    const activeIssue={
      id:'iss-1',document_id:'doc-1',state:'active',issue_version:2,
      issue_number:'BDS-2026-000001',verification_token:TOKEN,
      document_hash:'HASH-1',issued_hash:'IH-1',pdf_hash:pdfHash,
      signature_hash:'SIG-1',stamp_hash:'STAMP-1',
      issued_at:'2026-11-14T09:00:00.000Z',verification_count:0
    };
    scenario.results={
      'correspondence_issues:maybeSingle':[{data:activeIssue,error:null},{data:null,error:null}],
      'correspondence_documents:maybeSingle':[{data:boundDoc,error:null}]
    };
    const res=mockRes();
    await runCorrespondence(mockReq({method:'GET',query:{action:'verify',token:TOKEN}}),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.verified).toBe(true);
    expect(res._json.official_preview_url).toContain('action=official-preview');
    expect(res._json.official_pdf_url).toContain('download=1');
  });

  test('issuance rejects a concurrent signature or stamp change with 409',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    scenario.results=issueTransitionResults(approvedDoc,{
      data:null,
      error:{code:'PGRST116',message:'JSON object requested, multiple (or no) rows returned',details:'',hint:null}
    });
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'POST',
      headers:{host:'localhost',authorization:'Bearer valid-token'},
      query:{action:'transition',id:'doc-1'},
      body:{target:'issued'}
    }),res);
    expect(res.statusCode).toBe(409);
    expect(res._json.error).toContain('Signature or stamp changed during issuance');
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'signature_hash',val:'SIG-1'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'stamp_hash',val:'STAMP-1'});
    expect(scenario.sb.from).not.toHaveBeenCalledWith('correspondence_events');
  });

  test('issuance binds the observed signature and stamp hashes and issues successfully',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    const issuedDoc={
      ...approvedDoc,
      status:'issued',
      outgoing_number:'BDS-2026-000001',
      reference_number:'BDS-2026-000001',
      verification_token:TOKEN,
      issued_hash:'IH-1',
      issued_by:'admin-1',
      issued_at:'2026-11-14T09:00:00.000Z'
    };
    scenario.results=issueTransitionResults(approvedDoc,{data:issuedDoc,error:null});
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'POST',
      headers:{host:'localhost',authorization:'Bearer valid-token'},
      query:{action:'transition',id:'doc-1'},
      body:{target:'issued'}
    }),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.document.status).toBe('issued');
    expect(res._json.idempotent).toBe(false);
    expect(scenario.sb.rpc).toHaveBeenCalledWith('next_correspondence_register',{p_kind:'outgoing'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'id',val:'doc-1'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'status',val:'approved'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'signature_hash',val:'SIG-1'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'stamp_hash',val:'STAMP-1'});
    expect(scenario.sb.from).toHaveBeenCalledWith('correspondence_events');
  });

  test('issuance of an internal document locks the absent stamp with an is-null guard',async()=>{
    const scenario=makeScenario();
    mockCurrentScenario=scenario;
    const internalDoc={
      ...approvedDoc,
      direction:'internal',
      requires_stamp:false,
      stamp_hash:null,
      stamped_by:null,
      stamped_at:null,
      reference_number:'BDS-INT-1'
    };
    const issuedDoc={
      ...internalDoc,
      status:'issued',
      verification_token:TOKEN,
      issued_hash:'IH-1',
      issued_by:'admin-1',
      issued_at:'2026-11-14T09:00:00.000Z'
    };
    scenario.results=issueTransitionResults(internalDoc,{data:issuedDoc,error:null});
    const res=mockRes();
    await runCorrespondence(mockReq({
      method:'POST',
      headers:{host:'localhost',authorization:'Bearer valid-token'},
      query:{action:'transition',id:'doc-1'},
      body:{target:'issued'}
    }),res);
    expect(res.statusCode).toBe(200);
    expect(res._json.document.status).toBe('issued');
    expect(scenario.documentUpdate.filters).toContainEqual({op:'eq',col:'signature_hash',val:'SIG-1'});
    expect(scenario.documentUpdate.filters).toContainEqual({op:'is',col:'stamp_hash',val:null});
  });
});
