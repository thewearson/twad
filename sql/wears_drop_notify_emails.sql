-- Notify emails for Studio. Anon can arm/disarm. Only service_role can read the list.
-- Paste in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.drop_notify_emails (
  pack_id text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, email)
);

ALTER TABLE public.drop_notify_emails ENABLE ROW LEVEL SECURITY;

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
  END IF;
  SELECT count(*) INTO n FROM public.drop_notify_emails WHERE pack_id = pack;
  RETURN jsonb_build_object('ok', true, 'n', n);
END;
$$;

REVOKE ALL ON FUNCTION public.wears_drop_notify_put(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wears_drop_notify_put(text, text, boolean) TO anon, authenticated;
GRANT ALL ON TABLE public.drop_notify_emails TO service_role;
