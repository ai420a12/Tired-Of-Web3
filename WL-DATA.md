# Collect WL data (Supabase — free)

Yes, the free Supabase plan is enough for this.

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

1. [vercel.com](https://vercel.com) → project **tired-of-web3**  
2. **Settings → Environment Variables**  
3. Add:

| Name | Value |
|------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |

4. Apply to **Production** (and Preview if you want)  
5. **Deployments → … on latest → Redeploy**  
   (or push a small commit so it redeploys)

### 5) Test

1. Open `https://tiredofweb3.xyz/wl` (or your vercel.app URL)  
2. Submit a test application  
3. In Supabase → **Table Editor → wl_submissions**  
4. You should see the new row  

### 6) Export your list anytime

Supabase → **Table Editor → wl_submissions** → **Export** → CSV  
Open in Excel / Google Sheets.

---

## What I already built in the code

- Live site saves to Supabase when those env vars exist  
- Localhost still uses `data/wl-submissions.json` if env vars are missing  
- Public visitors cannot download the full WL list from `/api/wl`

---

## Optional localhost test with Supabase

Create `.env.local` in the project root:

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Then `npm run dev` and submit on localhost — it will write to the same cloud table.
