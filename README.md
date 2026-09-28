# THE WEARS ON STUDIO

Private editor for THE WEARS ON. Same Supabase as the iOS app. Not the public site.

## Cloudflare

Git: empty build command, production branch `main`.

Access must sit on **both**:

- Production: `twad.thewears-on.workers.dev` (Domains → Production → Manage — not preview)
- Preview: `*.twad.thewears-on.workers.dev`

`_worker.js` returns 403 without `Cf-Access-Jwt-Assertion`. Edge cache is `private, no-store`.

Incognito without Cloudflare login must not show STUDIO. After Access login, the placeholder is expected until the editor ships.

Keep this repository **private**. Admin login later is email/password + `role = admin` — no Google/Apple on this origin.
