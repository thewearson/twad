-- THE WEARS ON Studio compose
-- SQL Editor, once. No BEGIN / COMMIT. No DROP. Re-run safe.
-- Instagram handle on stars. Item store URLs. Admin upload to image-artist.

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS instagram text;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS listings jsonb;

ALTER TABLE public.outfits
  ADD COLUMN IF NOT EXISTS image_urls jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-artist',
  'image-artist',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'studio_admin_image_artist_select'
  ) THEN
    CREATE POLICY studio_admin_image_artist_select
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'image-artist' AND public.wears_viewer_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'studio_admin_image_artist_insert'
  ) THEN
    CREATE POLICY studio_admin_image_artist_insert
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'image-artist'
      AND public.wears_viewer_is_admin()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'studio_admin_image_artist_update'
  ) THEN
    CREATE POLICY studio_admin_image_artist_update
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'image-artist' AND public.wears_viewer_is_admin())
    WITH CHECK (bucket_id = 'image-artist' AND public.wears_viewer_is_admin());
  END IF;
END
$$;
