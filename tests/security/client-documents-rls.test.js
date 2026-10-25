const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const CLIENT_DOCS_MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260623000000_client_documents.sql'
);
const GENERIC_RLS_MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260722000001_enable_rls_all_tables.sql'
);
const STORAGE_RESTORE_MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20261025224500_restore_client_documents_storage_rls.sql'
);

describe('client document repository RLS contract', () => {
  const clientSql = fs.readFileSync(CLIENT_DOCS_MIGRATION, 'utf8');
  const genericSql = fs.readFileSync(GENERIC_RLS_MIGRATION, 'utf8');
  const restoreSql = fs.readFileSync(STORAGE_RESTORE_MIGRATION, 'utf8');

  test('client_documents row access is bound to advisory client ownership', () => {
    expect(clientSql).toMatch(
      /CREATE POLICY client_documents_client_select[\s\S]*FOR SELECT TO authenticated[\s\S]*c\.id = client_documents\.client_id AND c\.auth_user_id = auth\.uid\(\)/i
    );
    expect(clientSql).toMatch(
      /CREATE POLICY client_documents_client_insert[\s\S]*FOR INSERT TO authenticated[\s\S]*c\.id = client_documents\.client_id AND c\.auth_user_id = auth\.uid\(\)/i
    );
    expect(clientSql).toMatch(
      /CREATE POLICY client_documents_client_update[\s\S]*FOR UPDATE TO authenticated[\s\S]*c\.id = client_documents\.client_id AND c\.auth_user_id = auth\.uid\(\)/i
    );
  });

  test('client-documents storage access requires both bucket and object owner', () => {
    for (const action of ['SELECT', 'INSERT', 'DELETE']) {
      const policyName = `client_documents_${action.toLowerCase()}`;
      expect(clientSql).toContain(`CREATE POLICY ${policyName} ON storage.objects`);
    }

    expect(clientSql).toMatch(
      /FOR SELECT TO authenticated[\s\S]*bucket_id = 'client-documents' AND owner = auth\.uid\(\)/i
    );
    expect(clientSql).toMatch(
      /FOR INSERT TO authenticated[\s\S]*bucket_id = 'client-documents' AND owner = auth\.uid\(\)/i
    );
    expect(clientSql).toMatch(
      /FOR DELETE TO authenticated[\s\S]*bucket_id = 'client-documents' AND owner = auth\.uid\(\)/i
    );
  });

  test('raw upload contract remains private and capped at 10 MB', () => {
    expect(clientSql).toMatch(
      /INSERT INTO storage\.buckets\s*\(id, name, public, file_size_limit, allowed_mime_types\)[\s\S]*VALUES\s*\([\s\S]*'client-documents',[\s\S]*'client-documents',[\s\S]*false,[\s\S]*10485760/i
    );
  });

  test('generic RLS migration does not create bucket-only client-documents access', () => {
    expect(genericSql).not.toMatch(
      /bucket_id\s*=\s*'client-documents'/i
    );
  });

  test('latest storage hardening restores insert and uses current owner_id semantics', () => {
    for (const action of ['select', 'insert', 'delete']) {
      expect(restoreSql).toContain(`create policy client_documents_${action}`);
    }
    expect(restoreSql).toMatch(
      /client_documents_select[\s\S]*bucket_id = 'client-documents'[\s\S]*owner_id = \(select auth\.uid\(\)::text\)/i
    );
    expect(restoreSql).toMatch(
      /client_documents_insert[\s\S]*for insert[\s\S]*bucket_id = 'client-documents'[\s\S]*owner_id = \(select auth\.uid\(\)::text\)/i
    );
    expect(restoreSql).toMatch(
      /client_documents_delete[\s\S]*bucket_id = 'client-documents'[\s\S]*owner_id = \(select auth\.uid\(\)::text\)/i
    );
    expect(restoreSql).not.toMatch(/bucket_id = 'client-documents'\s*\)/i);
  });

  test('repository contract is verified against the production policy gap', () => {
    expect(clientSql).toContain('ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY');
    expect(restoreSql).toContain('drop policy if exists client_documents_insert on storage.objects;');
  });
});
