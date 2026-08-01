# AI Food Waste Exchange Platform

Connects food donors (restaurants, supermarkets, hotels, bakeries) with nearby NGOs, shelters, and volunteers in real time. AI estimates spoilage windows, recommends optimal NGO matches, and forecasts demand.

## Monorepo Layout

| Folder | What | Hosting (free tier) |
|---|---|---|
| `frontend/` | React + TypeScript + Vite + Tailwind + Leaflet | Vercel |
| `backend/` | NestJS (TypeScript) REST API | Render |
| `ml-service/` | Python FastAPI — spoilage prediction, NGO ranking, demand forecast | Render |
| `shared/` | Zod schemas + shared TypeScript types | (library) |
| `supabase/` | SQL migrations (Postgres + PostGIS), seed data | Supabase |

## Free-Tier Limits You Must Know

1. **Render free web services sleep after ~15 min idle** — first request after that takes ~30–50s (cold start). The frontend shows a "waking server…" state for this.
2. **Supabase free tier**: 500MB database cap, and **projects pause after 1 week of inactivity** (wake with one click in the dashboard). Before a demo, open the Supabase dashboard to make sure the project is awake.

## Local Setup

Prereqs: Node 20+, Python 3.11+, a free Supabase project.

```bash
# 1. Database — run migrations in the Supabase SQL editor (in order)
#    supabase/migrations/*.sql

# 2. Backend
cd backend
cp .env.example .env   # fill in Supabase URL/keys
npm install
npm run start:dev      # http://localhost:3000  (Swagger at /docs)

# 3. ML service
cd ml-service
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000               # http://localhost:8000/docs

# 4. Frontend
cd frontend
cp .env.example .env   # fill in Supabase + API URLs
npm install
npm run dev            # http://localhost:5173
```

See `DEPLOYMENT.md` for deploying to Vercel/Render/Supabase from scratch.
