/*
# Create storage bucket for image uploads

## Purpose
Stores profile photos and business logos uploaded from the user's
computer or mobile device. Previously these fields only accepted
manually-pasted URLs.

## Storage
- Bucket: `uploads` (public)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read uploaded files (public bucket)
DROP POLICY IF EXISTS "anon_read_uploads" ON storage.objects;
CREATE POLICY "anon_read_uploads" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'uploads');

-- Allow anyone to upload files
DROP POLICY IF EXISTS "anon_insert_uploads" ON storage.objects;
CREATE POLICY "anon_insert_uploads" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'uploads');

-- Allow anyone to update/replace files
DROP POLICY IF EXISTS "anon_update_uploads" ON storage.objects;
CREATE POLICY "anon_update_uploads" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'uploads') WITH CHECK (bucket_id = 'uploads');

-- Allow anyone to delete files
DROP POLICY IF EXISTS "anon_delete_uploads" ON storage.objects;
CREATE POLICY "anon_delete_uploads" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'uploads');
