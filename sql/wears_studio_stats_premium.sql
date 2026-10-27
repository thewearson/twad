-- THE WEARS ON Studio — daily member stats + grant / revoke Premium
-- SQL Editor, once. No BEGIN / COMMIT. No DROP of member data. Re-run safe.
--
-- Stats: signed-in members only. Foreground seconds. Aggregate by day.
-- Staff see people + total time, not a per-member screen-time list.
-- Rows older than 90 days are removed. Account delete cascades.
--
-- Premium: admin-only wears_studio_set_premium(member, on_premium).
-- Complements Apple StoreKit. App ORs this flag with an active subscription.
-- premium_origin: studio grant vs apple so a cancelled StoreKit sub can drop.

CREATE TABLE IF NOT EXISTS public.wears_usage_days (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  opens integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  CONSTRAINT wears_usage_days_seconds_chk CHECK (seconds >= 0 AND seconds <= 86400),
  CONSTRAINT wears_usage_days_opens_chk CHECK (opens >= 0 AND opens <= 48)
);

CREATE INDEX IF NOT EXISTS wears_usage_days_day_idx
  ON public.wears_usage_days (day DESC);

ALTER TABLE public.wears_usage_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wears_usage_days FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wears_ping_usage(add_seconds integer, new_open boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  sec int := GREATEST(0, LEAST(COALESCE(add_seconds, 0), 120));
  today date := (timezone('utc', now()))::date;
  bump int := CASE WHEN COALESCE(new_open, false) THEN 1 ELSE 0 END;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  IF sec = 0 AND bump = 0 THEN
    RETURN;
  END IF;
  IF bump = 1 THEN
    DELETE FROM public.wears_usage_days
    WHERE day < today - 90;
  END IF;
  INSERT INTO public.wears_usage_days (user_id, day, seconds, opens)
  VALUES (uid, today, sec, GREATEST(bump, 1))
  ON CONFLICT (user_id, day) DO UPDATE SET
    seconds = LEAST(86400, public.wears_usage_days.seconds + EXCLUDED.seconds),
    opens = LEAST(48, GREATEST(public.wears_usage_days.opens, 1) + bump);
END;
$$;

REVOKE ALL ON FUNCTION public.wears_ping_usage(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_ping_usage(integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.wears_studio_stats(span integer DEFAULT 14)
RETURNS TABLE (
  day date,
  people integer,
  seconds bigint,
  opens integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(COALESCE(span, 14), 90)) AS n,
      (timezone('utc', now()))::date AS today
  ),
  days AS (
    SELECT generate_series(b.today - (b.n - 1), b.today, '1 day'::interval)::date AS day
    FROM bounds b
  )
  SELECT
    d.day,
    COUNT(u.user_id)::integer,
    COALESCE(SUM(u.seconds), 0)::bigint,
    COALESCE(SUM(u.opens), 0)::integer
  FROM days d
  LEFT JOIN public.wears_usage_days u ON u.day = d.day
  WHERE EXISTS (
    SELECT 1 FROM public.users me
    WHERE me.id = auth.uid() AND me.role = 'admin'
  )
  GROUP BY d.day
  ORDER BY d.day DESC;
$$;

REVOKE ALL ON FUNCTION public.wears_studio_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_studio_stats(integer) TO authenticated, service_role;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS premium_origin text;

CREATE OR REPLACE FUNCTION public.wears_studio_set_premium(member uuid, on_premium boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users me
    WHERE me.id = auth.uid() AND me.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not admin';
  END IF;
  IF member IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.users
  SET is_premium = COALESCE(on_premium, false),
      premium_origin = CASE
        WHEN COALESCE(on_premium, false) THEN 'studio'
        ELSE NULL
      END
  WHERE id = member;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.wears_studio_set_premium(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_studio_set_premium(uuid, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
