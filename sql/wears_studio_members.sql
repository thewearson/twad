-- THE WEARS ON Studio — member roster (premium + gate)
-- SQL Editor, once. No BEGIN / COMMIT. No DROP.
-- Admin-only. One light join. No lookbook. No Auth Admin dump.
-- HOUSE = email / password. APPLE / GOOGLE = Sign in with Apple / Google.

CREATE OR REPLACE FUNCTION public.wears_studio_members()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  is_premium boolean,
  is_frozen boolean,
  is_admin boolean,
  provider text,
  providers text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.username,
    a.email::text,
    COALESCE((to_jsonb(u)->>'is_premium')::boolean, false),
    COALESCE((to_jsonb(u)->>'is_frozen')::boolean, false),
    COALESCE(to_jsonb(u)->>'role', '') = 'admin',
    COALESCE(
      NULLIF(a.raw_app_meta_data->>'provider', ''),
      (
        SELECT i.provider
        FROM auth.identities i
        WHERE i.user_id = u.id
        ORDER BY i.created_at ASC
        LIMIT 1
      ),
      'email'
    ),
    COALESCE(
      (
        SELECT string_agg(p, ',' ORDER BY p)
        FROM (
          SELECT DISTINCT i.provider AS p
          FROM auth.identities i
          WHERE i.user_id = u.id
        ) s
      ),
      a.raw_app_meta_data->>'provider',
      'email'
    ),
    a.created_at,
    a.last_sign_in_at
  FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE EXISTS (
    SELECT 1 FROM public.users me
    WHERE me.id = auth.uid() AND me.role = 'admin'
  )
  ORDER BY COALESCE((to_jsonb(u)->>'is_premium')::boolean, false) DESC, a.created_at DESC NULLS LAST
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.wears_studio_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_studio_members() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
