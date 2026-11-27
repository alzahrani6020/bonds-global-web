-- Run ONLY against a verified isolated restoration of BONDS PostgreSQL.
-- Example (only after verifying ISOLATED_DATABASE_URL points at a disposable host):
-- psql -X -At -v ON_ERROR_STOP=1 "$ISOLATED_DATABASE_URL" -f scripts/backup/export_isolated_storage_metadata.sql > isolated-inventory.json
-- This is read-only and emits exactly one JSON inventory object.
SELECT json_build_object(
  'project', 'hutxsqzplyuqgnghsrcs',
  'buckets', COALESCE((
    SELECT json_agg(b.id ORDER BY b.id) FROM storage.buckets b
  ), '[]'::json),
  'objects', COALESCE((
    SELECT json_agg(json_build_object(
      'bucket_id', o.bucket_id,
      'name', o.name,
      'id', o.id::text,
      'size', (o.metadata->>'size')::bigint
    ) ORDER BY o.bucket_id,o.name)
    FROM storage.objects o
  ), '[]'::json)
);
