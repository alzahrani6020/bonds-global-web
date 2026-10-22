/**
 * @jest-environment node
 */

const { EventEmitter } = require('events');

const mockRpc = jest.fn();
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc })
}));

const {
  classifyDocumentMetadata,
  normalizeDocumentExtraction,
  buildDocumentAssistantView
} = require('../../lib/assistant/document-intelligence');
const { assistantRouter } = require('../../v3/api/assistant');

function makeReq(body) {
  const req = new EventEmitter();
  req.method = 'POST';
  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body || {})));
    req.emit('end');
  });
  return req;
}

function makeRes(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[String(k).toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function call(path, body, user={ id:'user-doc-1' }) {
  return new Promise(resolve => assistantRouter(makeReq(body), makeRes(resolve), path, user));
}

describe('assistant document intelligence foundation', () => {
  beforeEach(() => mockRpc.mockReset());

  test.each([
    ['bank_statement_oct.pdf','application/pdf','bank_statement'],
    ['سجل تجاري شركة.pdf','application/pdf','commercial_registration'],
    ['قوائم مالية 2025.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','financial_statement'],
    ['VAT certificate.pdf','application/pdf','tax_certificate'],
    ['contract-client.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','contract'],
    ['unknown.bin','application/octet-stream','other']
  ])('classifies metadata deterministically: %s', (filename,mimeType,expected) => {
    expect(classifyDocumentMetadata({ filename, mimeType }).document_type).toBe(expected);
  });

  test('normalizes extracted fields with document provenance only', () => {
    const out = normalizeDocumentExtraction({
      documentId:'11111111-1111-4111-8111-111111111111',
      documentType:'bank_statement',
      fields:[
        { field:'account_number', value:'123', page:1, confidence:0.9 },
        { field:'balance', value:2500, page:2, section:'summary', confidence:1.4 },
        { field:'nested', value:{ unsafe:true }, page:3 }
      ]
    });

    expect(out.fields).toEqual([
      {
        field:'account_number',
        value:'123',
        provenance:{
          source:'document',
          document_id:'11111111-1111-4111-8111-111111111111',
          page:1,
          section:null,
          confidence:0.9
        }
      },
      {
        field:'balance',
        value:2500,
        provenance:{
          source:'document',
          document_id:'11111111-1111-4111-8111-111111111111',
          page:2,
          section:'summary',
          confidence:1
        }
      }
    ]);
  });

  test('document content never grants execution authorization', () => {
    const view = buildDocumentAssistantView({
      id:'11111111-1111-4111-8111-111111111111',
      filename:'contract.pdf',
      mime_type:'application/pdf',
      status:'uploaded'
    });

    expect(view.instructions_from_document_are_data_only).toBe(true);
    expect(view.execution_authorized).toBe(false);
  });

  test('API requires authenticated user', async () => {
    const response = await call('/assistant/documents/analyze', {
      document_id:'11111111-1111-4111-8111-111111111111'
    }, null);

    expect(response.statusCode).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('API rejects malformed document ids before database access', async () => {
    const response = await call('/assistant/documents/analyze', {
      document_id:'../../admin'
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe('DOCUMENT_ID_INVALID');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('API asks server-side ownership boundary for exact authenticated user', async () => {
    mockRpc.mockResolvedValueOnce({
      data:[{
        id:'11111111-1111-4111-8111-111111111111',
        client_id:'22222222-2222-4222-8222-222222222222',
        project_id:null,
        filename:'bank_statement.pdf',
        storage_path:'user/file.pdf',
        mime_type:'application/pdf',
        size_bytes:100,
        status:'analyzed',
        extracted_data:{
          document_type:'bank_statement',
          fields:[{ field:'balance', value:5000, page:1, confidence:0.98 }]
        }
      }],
      error:null
    });

    const response = await call('/assistant/documents/analyze', {
      document_id:'11111111-1111-4111-8111-111111111111'
    }, { id:'user-doc-1' });

    expect(mockRpc).toHaveBeenCalledWith('assistant_get_client_document', {
      p_user_id:'user-doc-1',
      p_document_id:'11111111-1111-4111-8111-111111111111'
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.document.classification.document_type).toBe('bank_statement');
    expect(response.body.extraction.fields[0].provenance.source).toBe('document');
    expect(response.body.document.execution_authorized).toBe(false);
  });

  test('owned lookup returns not_found instead of exposing cross-user existence', async () => {
    mockRpc.mockResolvedValueOnce({ data:[], error:null });

    const response = await call('/assistant/documents/analyze', {
      document_id:'11111111-1111-4111-8111-111111111111'
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('DOCUMENT_NOT_FOUND');
  });
});
