# THE WEARS ON STUDIO

Private editor for THE WEARS ON. Same Supabase as the iOS app. Not the public site.

## Cloudflare

Git: empty build command, production branch `main`.

Access must sit on **both**:

- Production: `twad.thewears-on.workers.dev` (Domains → Production → Manage — not preview)
- Preview: `*.twad.thewears-on.workers.dev`

`_worker.js` returns 403 without `Cf-Access-Jwt-Assertion`. Edge cache is `private, no-store`.

After Access: email + password (same Supabase as iOS). `users.role` must be `admin`. Table editor writes `artists` / `outfits` / `items` / `archives` via RLS. Nazım: paste `sql/wears_studio_admin_write.sql`, add `https://twad.thewears-on.workers.dev` to Auth redirect URLs.

Keep this repository **private**. No Google/Apple on this origin. No `service_role` in the browser.
