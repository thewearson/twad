-- THE WEARS ON — Archive Fits (premium vault)
-- SQL Editor, once. No BEGIN / COMMIT. No DROP. Re-run safe.
-- Studio writes archives + product cards. App Archive Fits menu reads archives only.

CREATE TABLE IF NOT EXISTS public.archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  artist_name text,
  artist text,
  name text,
  year text,
  image_url text,
  image_urls jsonb,
  tag text NOT NULL DEFAULT 'ARCHIVE',
  title text,
  description text
);

ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS artist_id uuid;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS artist_name text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS artist text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS year text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS image_urls jsonb;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS archive_id uuid;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_vault boolean NOT NULL DEFAULT false;
ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS is_vault boolean NOT NULL DEFAULT false;
ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS year text;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.items ALTER COLUMN outfit_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_archive_id_fkey') THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_archive_id_fkey
      FOREIGN KEY (archive_id) REFERENCES public.archives(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS items_archive_id_idx ON public.items (archive_id);
CREATE INDEX IF NOT EXISTS items_is_vault_idx ON public.items (is_vault);
CREATE INDEX IF NOT EXISTS archives_created_at_idx ON public.archives (created_at DESC);

CREATE OR REPLACE FUNCTION public.wears_viewer_is_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_premium FROM public.users u WHERE u.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.wears_viewer_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    OR COALESCE(
      (SELECT u.role = 'admin' FROM public.users u WHERE u.id = auth.uid()),
      false
    );
$$;

REVOKE ALL ON FUNCTION public.wears_viewer_is_premium() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wears_viewer_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_viewer_is_premium() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wears_viewer_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.wears_stamp_item_vault()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_vault boolean;
BEGIN
  IF (to_jsonb(NEW) ? 'archive_id') AND (to_jsonb(NEW)->>'archive_id') IS NOT NULL THEN
    NEW.is_vault := true;
    RETURN NEW;
  END IF;
  IF NEW.outfit_id IS NOT NULL THEN
    SELECT COALESCE(o.is_vault, false)
    INTO parent_vault
    FROM public.outfits o
    WHERE o.id = NEW.outfit_id;
    IF FOUND THEN
      NEW.is_vault := parent_vault;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  EXECUTE $t$
    CREATE OR REPLACE TRIGGER wears_stamp_item_vault
    BEFORE INSERT OR UPDATE OF outfit_id, archive_id, is_vault
    ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.wears_stamp_item_vault()
  $t$;
EXCEPTION WHEN undefined_column THEN
  EXECUTE $t$
    CREATE OR REPLACE TRIGGER wears_stamp_item_vault
    BEFORE INSERT OR UPDATE OF outfit_id, is_vault
    ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.wears_stamp_item_vault()
  $t$;
END
$$;

ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.archives TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.archives TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'archives' AND policyname = 'archives_select_premium'
  ) THEN
    CREATE POLICY archives_select_premium
    ON public.archives
    FOR SELECT
    TO anon, authenticated
    USING (
      public.wears_viewer_is_premium()
      OR public.wears_viewer_is_admin()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'archives' AND policyname = 'archives_write_admin'
  ) THEN
    CREATE POLICY archives_write_admin
    ON public.archives
    FOR ALL
    TO authenticated
    USING (public.wears_viewer_is_admin())
    WITH CHECK (public.wears_viewer_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'archives' AND policyname = 'studio_admin_all'
  ) THEN
    CREATE POLICY studio_admin_all
    ON public.archives
    FOR ALL
    TO authenticated
    USING (public.wears_viewer_is_admin())
    WITH CHECK (public.wears_viewer_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'items' AND policyname = 'items_vault_premium_only'
  ) THEN
    CREATE POLICY items_vault_premium_only
    ON public.items
    AS RESTRICTIVE
    FOR SELECT
    TO anon, authenticated
    USING (
      COALESCE(is_vault, false) = false
      OR public.wears_viewer_is_premium()
      OR public.wears_viewer_is_admin()
    );
  END IF;
END
$$;
