# data/

Local whitelist submissions are saved to `wl-submissions.json` **only while developing on localhost** (`NODE_ENV=development`, not Vercel).

On Vercel / production the local file store is forbidden. Use Supabase or `WL_WEBHOOK_URL` — see `WL-DATA.md`.

This file is gitignored so wallets/handles don't get pushed to GitHub by accident.

View submissions locally:
- Open `data/wl-submissions.json`
- Or visit `http://localhost:3000/api/wl` in your browser
