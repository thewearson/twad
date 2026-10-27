-- THE WEARS ON — Apple cancel vs Studio gift
-- SQL Editor, once. No BEGIN / COMMIT. No DROP of member data.
-- Sarı uyarı yok. Re-run safe.
--
-- StoreKit satın alma app'te premium_origin = apple yazar.
-- Studio GRANT studio yazar. REVOKE temizler.
-- Apple iptalinde origin apple ise is_premium kapanır; studio hediyesi durur.

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

DO $$
BEGIN
  GRANT UPDATE (premium_origin) ON TABLE public.users TO authenticated;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
