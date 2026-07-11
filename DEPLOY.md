# Deploy $TIRED to Vercel + TiredOfWeb3.xyz

Same idea as ThePenimals (buy domain → host site → point DNS), but hosting is **Vercel** instead of Cloudflare Pages because this is a Next.js app.

## What you do (≈15 minutes)

### Step 1 — Put the code on GitHub

1. Open [github.com/new](https://github.com/new)
2. Repository name: `tired-web` (or `TiredOfWeb3`)
3. **Private** or **Public** — your call
4. **Do not** add README, .gitignore, or license (we already have them)
5. Click **Create repository**

6. In Terminal, from this folder:

```bash
cd ~/projects/tired-web

git add .
git commit -m "Initial $TIRED site"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tired-web.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with **GitHub**
2. **Add New…** → **Project**
3. Import the `tired-web` repo
4. Settings (Vercel auto-fills these — **don’t change**):
   - Framework: **Next.js**
   - Build Command: `npm run build`
   - Output: (default)
   - Install Command: `npm install`
5. Click **Deploy**
6. Wait ~2 minutes → you get a link like `tired-web-xxx.vercel.app` — click it to confirm the site works

---

### Step 3 — Add your domain in Vercel

1. Vercel project → **Settings** → **Domains**
2. Add: `tiredofweb3.xyz`
3. Add: `www.tiredofweb3.xyz` (optional; Vercel can redirect www → apex)
4. Vercel shows **DNS records** — keep that page open

Typical Vercel records:

| Type | Host | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Use whatever Vercel shows if it differs.

---

### Step 4 — Point Namecheap DNS

1. [namecheap.com](https://www.namecheap.com) → **Domain List** → **TiredOfWeb3.xyz** → **Manage**
2. **Advanced DNS**
3. Remove old **Parking** / conflicting **A** / **CNAME** records for `@` and `www`
4. Add the records from Step 3
5. **Save**

DNS usually updates in **5–30 minutes** (sometimes up to a few hours).

---

### Step 5 — Confirm

- Vercel **Domains** tab shows **Valid Configuration** (green)
- Open [https://tiredofweb3.xyz](https://tiredofweb3.xyz) — site loads with SSL (padlock)

---

## After deploy — updates

Push to `main` on GitHub → Vercel redeploys automatically.

```bash
cd ~/projects/tired-web
git add .
git commit -m "your message"
git push
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Domain shows Vercel 404 | Wait for DNS; check Namecheap records match Vercel exactly |
| Build fails on Vercel | Project → **Deployments** → failed deploy → **Building** logs |
| www works but apex doesn’t | Ensure **A** record for `@` is set |
| SSL pending | Wait 10–20 min after DNS propagates |

---

## Already done in the codebase

- `metadataBase`: `https://tiredofweb3.xyz` (SEO / social previews)
- Production build tested (`npm run build`)
