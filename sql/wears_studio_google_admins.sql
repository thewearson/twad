-- THE WEARS ON Studio — Google seats (Tuna + Nazım)
-- SQL Editor, once. No BEGIN / COMMIT. No DROP.
-- Put the two Gmail addresses you use to sign into the iOS app.

UPDATE public.users u
SET role = 'admin'
FROM auth.users a
WHERE u.id = a.id
  AND lower(a.email) IN (
    'thewears.on@gmail.com'
  );
