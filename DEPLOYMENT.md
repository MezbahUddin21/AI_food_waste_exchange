# Deployment — 100% Free Tier

Exact steps to deploy (or redeploy from scratch). Total cost: **$0**, no credit card required anywhere.

## 1. Supabase (database + auth + storage)

1. Create a free project at [supabase.com](https://supabase.com) → note the **Project URL**, **anon key**, **service_role key**, and **JWT secret** (Project Settings → API).
2. SQL Editor → run the migrations **in order**:
   - `supabase/migrations/0001_extensions_and_enums.sql`
   - `supabase/migrations/0002_tables.sql`
   - `supabase/migrations/0003_indexes_and_rpc.sql`
   - `supabase/migrations/0004_rls_and_storage.sql`
3. (Demo data) Authentication → Users → create `donor@demo.io`, `ngo@demo.io`, `volunteer@demo.io`, `admin@demo.io`; copy their user IDs into `supabase/seed/9999_seed_demo.sql` and run it.
4. Authentication → Providers → Email: for demos, disable "Confirm email" so signups work instantly.

## 2. Render (backend + ML service — two free web services)

Push this repo to GitHub first.

**Backend:**
- New → Web Service → connect the repo
- Root directory: `backend` · Runtime: Node
- Build: `npm install && npm run build` · Start: `npm run start`
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ML_SERVICE_URL` (fill after step below), `FRONTEND_ORIGIN` (your Vercel URL), `NODE_ENV=production`

**ML service:**
- New → Web Service → same repo
- Root directory: `ml-service` · Runtime: Python
- Build: `pip install -r requirements.txt` · Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Copy its URL into the backend's `ML_SERVICE_URL` env var.

> ⚠️ Free Render services **sleep after ~15 min idle** and take ~30–50 s to wake. The frontend shows a "waking up" banner automatically. The backend also has a spoilage-prediction fallback, so a sleeping ML service never blocks listing food.

## 3. Vercel (frontend)

- Import the GitHub repo → Framework: Vite → Root directory: `frontend`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` = `https://<your-backend>.onrender.com/api/v1`
- Auto-deploys on every push to `main`.

## 4. Free-tier gotchas (read before a demo!)

| Limit | Mitigation |
|---|---|
| Render cold start (~30–50 s) | Open the backend URL a minute before demoing; UI shows a banner |
| Supabase pauses after 1 week idle | Open the Supabase dashboard and click Restore before demoing |
| Supabase 500 MB DB cap | Fine for thousands of donations; photos live in Storage (1 GB) |
| Nominatim geocoding: 1 req/s | Only called on signup/listing — well within limits |

## 5. Never commit secrets

All keys live in each platform's dashboard env settings. `.env` files are gitignored; only `.env.example` templates are committed.
