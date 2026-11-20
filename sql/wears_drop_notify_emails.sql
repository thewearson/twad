-- Drop notify inbox. Source of truth for every armed email (100k cap).
-- Anon can arm/disarm. Only service_role (Studio) can read or send.
-- Paste in Supabase SQL editor, then hard-refresh Studio.

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

ALTER TABLE public.drop_notify_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drop_notify_state ENABLE ROW LEVEL SECURITY;

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

REVOKE ALL ON FUNCTION public.wears_drop_notify_put(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_drop_notify_put(text, text, boolean) TO anon, authenticated;
GRANT ALL ON TABLE public.drop_notify_emails TO service_role;
GRANT ALL ON TABLE public.drop_notify_state TO service_role;
