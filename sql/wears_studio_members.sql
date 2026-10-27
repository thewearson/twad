-- THE WEARS ON Studio — member roster (premium + gate)
-- SQL Editor, once. No BEGIN / COMMIT. No DROP.
-- HOUSE = email / password. APPLE / GOOGLE = Sign in with Apple / Google.
-- Reads auth.identities (Apple/Google). Same doors the iOS app uses.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_providers text;

GRANT UPDATE (auth_provider, auth_providers) ON TABLE public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.wears_member_gate(uid uuid)
RETURNS TABLE (gate text, gates text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH ids AS (
    SELECT
      i.provider AS raw,
      COALESCE(
        NULLIF(i.identity_data->>'iss', ''),
        NULLIF(i.identity_data->>'email', ''),
        ''
      ) AS hint
    FROM auth.identities i
    WHERE i.user_id = uid
  ),
  folded AS (
    SELECT DISTINCT
      CASE
        WHEN lower(raw) IN ('apple', 'apple.com') OR hint ILIKE '%apple%' THEN 'apple'
        WHEN lower(raw) IN ('google', 'google.com') OR hint ILIKE '%google%' THEN 'google'
        WHEN lower(raw) IN ('email', 'password', 'phone') THEN 'email'
        ELSE COALESCE(NULLIF(lower(raw), ''), 'email')
      END AS p
    FROM ids
  ),
  meta AS (
    SELECT
      a.email,
      lower(COALESCE(NULLIF(a.raw_app_meta_data->>'provider', ''), '')) AS app_provider,
      a.raw_app_meta_data->'providers' AS app_providers,
      lower(COALESCE(a.raw_user_meta_data->>'iss', '')) AS iss
    FROM auth.users a
    WHERE a.id = uid
  ),
  extra AS (
    SELECT
      CASE
        WHEN iss ILIKE '%apple%' OR email ILIKE '%@privaterelay.appleid.com' THEN 'apple'
        WHEN iss ILIKE '%google%' THEN 'google'
        WHEN app_provider IN ('apple', 'apple.com') THEN 'apple'
        WHEN app_provider IN ('google', 'google.com') THEN 'google'
        WHEN app_provider IN ('email', 'password', 'phone', '') THEN 'email'
        ELSE NULLIF(app_provider, '')
      END AS p
    FROM meta
    UNION
    SELECT
      CASE
        WHEN lower(x) IN ('apple', 'apple.com') THEN 'apple'
        WHEN lower(x) IN ('google', 'google.com') THEN 'google'
        WHEN lower(x) IN ('email', 'password', 'phone') THEN 'email'
        ELSE NULLIF(lower(x), '')
      END
    FROM meta, LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(app_providers) = 'array' THEN app_providers ELSE '[]'::jsonb END
    ) AS x
  ),
  all_p AS (
    SELECT p FROM folded WHERE p IS NOT NULL
    UNION
    SELECT p FROM extra WHERE p IS NOT NULL
  ),
  ranked AS (
    SELECT p FROM all_p
  )
  SELECT
    COALESCE(
      (SELECT p FROM ranked WHERE p IN ('apple', 'google') LIMIT 1),
      (SELECT p FROM ranked LIMIT 1),
      'email'
    ),
    COALESCE(
      (SELECT string_agg(p, ',' ORDER BY CASE p WHEN 'apple' THEN 0 WHEN 'google' THEN 1 ELSE 2 END, p) FROM ranked),
      'email'
    );
$$;

REVOKE ALL ON FUNCTION public.wears_member_gate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_member_gate(uuid) TO authenticated, service_role;

UPDATE public.users u
SET
  auth_provider = s.gate,
  auth_providers = s.gates
FROM (
  SELECT u2.id, g.gate, g.gates
  FROM public.users u2
  CROSS JOIN LATERAL public.wears_member_gate(u2.id) g
) s
WHERE u.id = s.id
  AND (
    COALESCE(u.auth_provider, '') IS DISTINCT FROM s.gate
    OR COALESCE(u.auth_providers, '') IS DISTINCT FROM s.gates
  );

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
    COALESCE(NULLIF(to_jsonb(u)->>'auth_provider', ''), g.gate, 'email'),
    COALESCE(NULLIF(to_jsonb(u)->>'auth_providers', ''), g.gates, 'email'),
    a.created_at,
    a.last_sign_in_at
  FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  LEFT JOIN LATERAL public.wears_member_gate(u.id) g ON true
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
