-- THE WEARS ON — THE DRIP NEWS
-- SQL Editor, once. No BEGIN / COMMIT. No DROP. Re-run safe.
-- Studio compose + iOS member read. Photos live in image-artist/news/.

CREATE TABLE IF NOT EXISTS public.drip_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'CULTURE',
  title text NOT NULL DEFAULT '',
  dek text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'THE WEARS EDITORIAL',
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_name text NOT NULL DEFAULT '',
  release_date text NOT NULL DEFAULT '',
  buy_url text NOT NULL DEFAULT '',
  buy_note text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS drip_news_created_at_idx
  ON public.drip_news (created_at DESC);

ALTER TABLE public.drip_news ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.drip_news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.drip_news TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drip_news'
      AND policyname = 'drip_news_read'
  ) THEN
    CREATE POLICY drip_news_read
    ON public.drip_news
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF to_regprocedure('public.wears_viewer_is_admin()') IS NOT NULL
     AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drip_news'
      AND policyname = 'studio_admin_all'
  ) THEN
    CREATE POLICY studio_admin_all
    ON public.drip_news
    FOR ALL
    TO authenticated
    USING (public.wears_viewer_is_admin())
    WITH CHECK (public.wears_viewer_is_admin());
  END IF;
END
$$;

UPDATE storage.buckets
SET
  file_size_limit = 16777216,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'image-artist';
