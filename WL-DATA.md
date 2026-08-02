# Collect WL data (Supabase — free)

Yes, the free Supabase plan is enough for this.

---

## Never break again (checklist)

Production MUST have a durable store. Local JSON (`data/wl-submissions.json`) is **forbidden** on Vercel — it causes read-only FS failures.

### Required on Vercel (pick ONE path)

**Primary (recommended):**

| Name | Value |
|------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |

**Fallback (one env var — keeps WL alive if Supabase is missing):**

| Name | Value |
|------|--------|
| `WL_WEBHOOK_URL` | Discord webhook URL (or Slack-compatible incoming webhook) |

Optional:

| Name | Value |
|------|--------|
| `WL_ADMIN_SECRET` | long random string — unlocks full list via `GET /api/wl` |

### After every deploy

1. Open `https://tiredofweb3.xyz/api/wl` (or your vercel.app URL)
2. Confirm JSON looks like:
   ```json
   { "ok": true, "store": "supabase", "hasUrl": true, "hasKey": true, "hasWebhook": false }
   ```
3. If you see `"store": "misconfigured"` or `"ok": false` → **do not announce WL** until env vars are set + redeployed
4. Submit a test application on `/wl`
5. Supabase → **Table Editor → wl_submissions** (or check Discord if using webhook)

### CLI (set Production env from a machine that has the values)

```bash
printf '%s' 'https://YOUR_PROJECT.supabase.co' | npx vercel@57.0.0 env add SUPABASE_URL production
printf '%s' 'YOUR_SERVICE_ROLE_KEY' | npx vercel@57.0.0 env add SUPABASE_SERVICE_ROLE_KEY production
# optional fallback:
printf '%s' 'https://discord.com/api/webhooks/...' | npx vercel@57.0.0 env add WL_WEBHOOK_URL production

npx vercel@57.0.0 --prod --force
npx vercel@57.0.0 alias set <deployment-url> tiredofweb3.xyz
npx vercel@57.0.0 alias set <deployment-url> www.tiredofweb3.xyz
```

### Regression guard

```bash
npm run test:wl-store
```

Asserts `addLocal` is never selected when `VERCEL=1`.

---

## You do this (about 10 minutes)

### 1) Create Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up / log in  
2. **New project**  
3. Name: `tired-wl` (anything)  
4. Set a database password (save it)  
5. Region: closest to you  
6. Wait until the project is ready  

### 2) Create the table

1. Left sidebar → **SQL Editor**  
2. **New query**  
3. Paste everything from `supabase/wl_submissions.sql` in this repo  
4. Click **Run**  

You should see success / no errors.

### 3) Copy your keys

1. Left sidebar → **Project Settings** (gear) → **API**  
2. Copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role** key (secret) → this is `SUPABASE_SERVICE_ROLE_KEY`  
     ⚠️ Never share this key publicly. Never put it in frontend code.

### 4) Add keys to Vercel

1. [vercel.com](https://vercel.com) → project **tired-of-web3** / **tired-web**  
2. **Settings → Environment Variables**  
3. Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for **Production**  
4. **Deployments → … on latest → Redeploy**  
   (or push so it redeploys)

### 5) Test

1. `GET https://tiredofweb3.xyz/api/wl` → `store: "supabase"`  
2. Open `https://tiredofweb3.xyz/wl` and submit a test application  
3. In Supabase → **Table Editor → wl_submissions**  
4. You should see the new row  

### 6) Export your list anytime

Supabase → **Table Editor → wl_submissions** → **Export** → CSV  
Open in Excel / Google Sheets.

---

## What the code does

- **Supabase** when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` exist  
- Else **Discord/Slack webhook** when `WL_WEBHOOK_URL` exists  
- Else **local JSON** only in `NODE_ENV=development` (never on Vercel)  
- On Vercel with neither → **503** + clear message (no FS write)  
- `GET /api/wl` returns `{ ok, store, hasUrl, hasKey, hasWebhook }` (never leaks secrets)  
- Vercel builds print a screaming warning if misconfigured  

---

## Optional localhost test with Supabase

Create `.env.local` in the project root:

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# optional:
# WL_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Then `npm run dev` and submit on localhost — it will write to the same cloud table.
