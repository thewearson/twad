-- Drop notify inbox. One list for web + iOS + Studio.
-- Anon arms. service_role claims/sends. 100k cap. Paste in SQL editor.

CREATE TABLE IF NOT EXISTS public.drop_notify_emails (
  pack_id text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, email)
);

CREATE INDEX IF NOT EXISTS drop_notify_emails_pack_created_idx
  ON public.drop_notify_emails (pack_id, created_at);

CREATE TABLE IF NOT EXISTS public.drop_notify_state (
  pack_id text PRIMARY KEY,
  sent_store_ids text[] NOT NULL DEFAULT '{}',
  lock_done boolean NOT NULL DEFAULT false,
  wave jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drop_notify_state
  ADD COLUMN IF NOT EXISTS wave jsonb;

CREATE TABLE IF NOT EXISTS public.drop_notify_outbox (
  pack_id text NOT NULL,
  store_id text NOT NULL,
  email text NOT NULL,
  claimed_at timestamptz,
  sent_at timestamptz,
  PRIMARY KEY (pack_id, store_id, email)
);

CREATE INDEX IF NOT EXISTS drop_notify_outbox_open_idx
  ON public.drop_notify_outbox (pack_id, store_id, email)
  WHERE sent_at IS NULL;

ALTER TABLE public.drop_notify_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_notify_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_notify_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wears_drop_notify_put(p_pack text, p_email text, p_off boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pack text := lower(trim(p_pack));
  addr text := lower(trim(p_email));
  n int;
  ins int;
BEGIN
  IF pack !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'bad pack';
  END IF;
  IF addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(addr) > 180 THEN
    RAISE EXCEPTION 'bad email';
  END IF;
  IF coalesce(p_off, false) THEN
    DELETE FROM public.drop_notify_emails WHERE pack_id = pack AND email = addr;
  ELSE
    INSERT INTO public.drop_notify_emails (pack_id, email)
    VALUES (pack, addr)
    ON CONFLICT (pack_id, email) DO NOTHING;
    GET DIAGNOSTICS ins = ROW_COUNT;
    IF ins = 1 THEN
      SELECT count(*) INTO n FROM public.drop_notify_emails WHERE pack_id = pack;
      IF n > 100000 THEN
        DELETE FROM public.drop_notify_emails WHERE pack_id = pack AND email = addr;
        RAISE EXCEPTION 'list full';
      END IF;
    END IF;
  END IF;
  SELECT count(*) INTO n FROM public.drop_notify_emails WHERE pack_id = pack;
  RETURN jsonb_build_object('ok', true, 'n', n);
END;
$$;

CREATE OR REPLACE FUNCTION public.wears_drop_notify_claim(
  p_pack text,
  p_store text,
  p_limit integer DEFAULT 40,
  p_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pack text := lower(trim(p_pack));
  store text := lower(trim(p_store));
  n_lim int := greatest(1, least(coalesce(p_limit, 40), 40));
  claimed text[] := '{}';
  remain int := 0;
  armed int := 0;
BEGIN
  IF pack !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'bad pack';
  END IF;
  IF store !~ '^[a-z0-9]{1,24}$' THEN
    RAISE EXCEPTION 'bad store';
  END IF;
  IF coalesce(p_reset, false) THEN
    DELETE FROM public.drop_notify_outbox WHERE pack_id = pack AND store_id = store;
  END IF;
  UPDATE public.drop_notify_outbox
  SET claimed_at = NULL
  WHERE pack_id = pack
    AND store_id = store
    AND sent_at IS NULL
    AND claimed_at IS NOT NULL
    AND claimed_at < now() - interval '3 minutes';
  INSERT INTO public.drop_notify_outbox (pack_id, store_id, email)
  SELECT e.pack_id, store, e.email
  FROM public.drop_notify_emails e
  WHERE e.pack_id = pack
  ON CONFLICT (pack_id, store_id, email) DO NOTHING;
  WITH picked AS (
    SELECT o.email
    FROM public.drop_notify_outbox o
    WHERE o.pack_id = pack
      AND o.store_id = store
      AND o.sent_at IS NULL
      AND o.claimed_at IS NULL
    ORDER BY o.email
    LIMIT n_lim
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.drop_notify_outbox o
    SET claimed_at = now()
    FROM picked
    WHERE o.pack_id = pack
      AND o.store_id = store
      AND o.email = picked.email
    RETURNING o.email
  )
  SELECT coalesce(array_agg(upd.email ORDER BY upd.email), '{}') INTO claimed FROM upd;
  SELECT count(*) INTO armed FROM public.drop_notify_emails WHERE pack_id = pack;
  SELECT count(*) INTO remain
  FROM public.drop_notify_outbox
  WHERE pack_id = pack AND store_id = store AND sent_at IS NULL;
  RETURN jsonb_build_object(
    'ok', true,
    'emails', to_jsonb(claimed),
    'remain', remain,
    'armed', armed,
    'done', armed > 0 AND remain = 0,
    'empty', armed = 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wears_drop_notify_mark(
  p_pack text,
  p_store text,
  p_emails text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pack text := lower(trim(p_pack));
  store text := lower(trim(p_store));
  n int := 0;
BEGIN
  IF pack !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'bad pack';
  END IF;
  IF store !~ '^[a-z0-9]{1,24}$' THEN
    RAISE EXCEPTION 'bad store';
  END IF;
  UPDATE public.drop_notify_outbox
  SET sent_at = now()
  WHERE pack_id = pack
    AND store_id = store
    AND sent_at IS NULL
    AND email = ANY (coalesce(p_emails, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'n', n);
END;
$$;

REVOKE ALL ON FUNCTION public.wears_drop_notify_put(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wears_drop_notify_claim(text, text, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wears_drop_notify_mark(text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_drop_notify_put(text, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wears_drop_notify_claim(text, text, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.wears_drop_notify_mark(text, text, text[]) TO service_role;
GRANT ALL ON TABLE public.drop_notify_emails TO service_role;
GRANT ALL ON TABLE public.drop_notify_state TO service_role;
GRANT ALL ON TABLE public.drop_notify_outbox TO service_role;

NOTIFY pgrst, 'reload schema';
