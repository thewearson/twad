-- THE WEARS ON · fit-check carousel (max 3). SQL Editor, once. No BEGIN / COMMIT. No DROP.

ALTER TABLE public.outfits
  ADD COLUMN IF NOT EXISTS image_urls jsonb;
