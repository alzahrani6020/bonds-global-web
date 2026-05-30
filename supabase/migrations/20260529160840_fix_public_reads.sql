DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;

CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');
