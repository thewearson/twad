-- THE WEARS ON Studio — admin table writes
-- SQL Editor, once. No BEGIN / COMMIT. No DROP. Re-run safe.
-- Browser uses authenticated JWT + wears_viewer_is_admin(). No service_role.

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

REVOKE ALL ON FUNCTION public.wears_viewer_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_viewer_is_admin() TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artists', 'outfits', 'items', 'archives']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = 'studio_admin_all'
    ) THEN
      EXECUTE format(
        $p$
          CREATE POLICY studio_admin_all
          ON public.%I
          FOR ALL
          TO authenticated
          USING (public.wears_viewer_is_admin())
          WITH CHECK (public.wears_viewer_is_admin())
        $p$,
        t
      );
    END IF;
  END LOOP;
END
$$;
