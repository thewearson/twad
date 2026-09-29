-- THE WEARS ON · item availability (Studio card). SQL Editor, once. No BEGIN / COMMIT. No DROP.
-- in_stock | sold_out | exclusive | friends_family
-- App: sold out / exclusive / friends & family do not open a store.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'in_stock';
