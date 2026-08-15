## AI Food Waste Exchange Platform

**Rescue surplus food before it spoils.** FoodBridge connects food donors (restaurants, supermarkets, hotels, bakeries) with nearby NGOs, shelters, and volunteers in real time. AI estimates spoilage windows, ranks the best NGO matches for every donation, and forecasts demand so food gets to people — not landfills.
---


## Table of Contents

- [Why This Exists](#why-this-exists)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [AI / ML Services](#ai--ml-services)
- [Data Model](#data-model)
- [User Roles](#user-roles)
- [Monorepo Layout](#monorepo-layout)
- [Local Setup](#local-setup)
- [Running with Docker](#running-with-docker)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Free-Tier Hosting Notes](#free-tier-hosting-notes)
- [Roadmap](#roadmap)

---

## Why This Exists

Roughly **one-third of all food produced globally is wasted**, while millions go hungry — often in the same city. The bottleneck usually isn't willingness to donate; it's **logistics and timing**:

- A restaurant has 40 servings of cooked biryani at closing time — safe to eat for only a few more hours.
- A shelter two kilometres away needs exactly that — but has no idea it exists.
- A volunteer with a motorbike could bridge the gap — if someone told them where to go.

FoodBridge closes that loop: donors list surplus in under a minute, AI estimates how long the food stays safe, the matching engine ranks nearby NGOs by distance, capacity, and reliability, and volunteers handle pickup and delivery — all tracked live on a map.

## Key Features

| | Feature | Description |
|---|---|---|
| 🥘 | **One-minute donation listing** | Donors post surplus food with category, quantity, storage condition, packaging, and photos |
| ⏱️ | **AI spoilage prediction** | Estimates a safe-consumption window from food category, storage, packaging, and ambient temperature — grounded in USDA food-safety guidance |
| 🎯 | **Smart NGO matching** | Weighted scoring engine ranks candidate NGOs by distance, capacity, category fit, and historical reliability |
| 🗺️ | **Live map view** | Leaflet + PostGIS geospatial queries show donations, NGOs, and pickups in real time |
| 🚴 | **Volunteer dispatch** | Volunteers accept assignments, with vehicle type (bike → van) factored into what they can carry |
| 🚨 | **Emergency requests** | NGOs broadcast urgent needs (e.g., disaster response); nearby donors are notified immediately |
| 🔔 | **Real-time notifications** | Clickable, in-app notifications for claims, assignments, status changes, and emergencies |
| 📊 | **Analytics dashboard** | Meals rescued, kg diverted from landfill, CO₂-equivalent saved, donor/NGO leaderboards |
| 📈 | **Demand forecasting** | Weekday/hour seasonal baseline that upgrades to a trained model as history accumulates |
| 🛡️ | **Role-based access** | Donor / NGO / Volunteer / Government / Admin roles enforced with Supabase Auth + Postgres RLS |

## How It Works

The core flow is a **donation lifecycle state machine**:

```
listed ──▶ claimed ──▶ assigned ──▶ in_transit ──▶ delivered ──▶ verified
   │
   └────────────▶ expired / cancelled
```

1. **Donor lists** surplus food. The ML service immediately predicts an expiry window (`predicted_expiry_at`).
2. **Matching engine** scores nearby NGOs (`score = 0.40·distance + 0.25·category-fit + 0.20·capacity + 0.15·reliability`) and notifies the best matches.
3. **NGO claims** the donation, then either self-picks-up or requests a volunteer.
4. **Volunteer accepts** the assignment (`offered → accepted → picked_up → delivered`).
5. **NGO verifies** receipt — impact metrics (meals, kg, CO₂e) are recorded and aggregated on the analytics dashboard.

Every transition is written to an append-only `status_events` audit table.

## Architecture

```
┌───────────────────────────┐
│         Frontend          │  React 18 · TypeScript · Vite
│   Vercel (static hosting) │  Tailwind CSS · Leaflet maps
└─────────────┬─────────────┘
              │ REST /api/v1  (JWT bearer)
┌─────────────▼─────────────┐        ┌───────────────────────────┐
│         Backend           │  HTTP  │        ML Service         │
│   NestJS REST API         ├───────▶│  Python FastAPI           │
│   Render (web service)    │        │  /spoilage /rank /forecast│
└─────────────┬─────────────┘        └───────────────────────────┘
              │ service-role client
┌─────────────▼─────────────┐
│         Supabase          │  Postgres 15 + PostGIS
│  Auth · Database · Storage│  Row-Level Security policies
└───────────────────────────┘
```

**Design decisions worth noting:**

- **ML is a separate microservice** — Python owns the modelling world; the NestJS backend just calls it over HTTP. Swapping a rule-based model for XGBoost changes zero backend code.
- **Supabase Auth issues JWTs**, the backend verifies them with the project JWT secret, and Postgres **RLS policies** are a second line of defence even if the API is bypassed.
- **PostGIS `geography` columns + GiST indexes** power "NGOs within X km" queries via a SQL RPC — no in-app haversine loops.
- **Shared Zod schemas** (`shared/`) keep the frontend and backend agreeing on request/response shapes at compile time *and* runtime.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Leaflet, Recharts |
| Backend API | NestJS 10 (TypeScript), Swagger/OpenAPI at `/docs` |
| ML service | Python 3.11, FastAPI, Pydantic, Uvicorn |
| Database | Supabase — Postgres 15 + **PostGIS**, Row-Level Security, Storage (photos) |
| Auth | Supabase Auth (email + password, email confirmation), JWT verification in the API |
| Validation | Zod (shared schemas), class-validator (NestJS), Pydantic (FastAPI) |
| Deployment | Vercel (frontend) · Render (backend + ML) · Supabase (DB/Auth/Storage) |
| Containers | Per-service Dockerfiles + `docker-compose.yml` for one-command local orchestration |

## AI / ML Services

All three endpoints are **deliberately interpretable v1 models** with a documented upgrade path — every constant is defensible to a food-safety reviewer, and each module exposes the same interface a trained model would, so they can be swapped in-place once real outcome data accumulates.

### 1. Spoilage Prediction — `POST /spoilage/predict`

Rule-based shelf-life model grounded in **USDA food-safety guidance** (2-hour/4-hour danger-zone rules, refrigeration windows per category):

```
shelf_hours = BASE[category] × storage_mult × packaging_mult × temp_mult
```

- Base shelf life per category (cooked meal: 4h at room temp → packaged: 30 days)
- Storage multipliers: frozen ×12, refrigerated ×3, room temp ×1, hot-held ×0.75
- Packaging: sealed ×1.25, covered ×1.0, open ×0.75
- Ambient temperature above ~25 °C shrinks unrefrigerated shelf life quickly

*Upgrade path:* swap for XGBoost/LightGBM regressor trained on actual pickup-outcome data — same `predict(features) → hours` contract.

### 2. NGO Ranking — `POST /rank/ngos`

Weighted linear scorer over candidate NGOs:

| Signal | Weight | Meaning |
|---|---|---|
| Distance | 0.40 | Closer NGOs score higher (25 km cutoff) |
| Category match | 0.25 | Does the NGO accept this food category? |
| Capacity | 0.20 | Can they absorb this many servings today? |
| Reliability | 0.15 | Historical accept-and-complete rate |

*Upgrade path:* weights become learnable parameters (logistic regression → learning-to-rank) once accept/decline outcomes exist.

### 3. Demand Forecast — `POST /forecast/demand`

Naive seasonal baseline (weekday × hour-of-day pattern; weekends see ~30% higher shelter demand) that powers the forecast panel today. *Upgrade path:* per-area Holt-Winters or LightGBM on lagged features after ~3 months of history — identical request/response contract.

## Data Model

Nine core tables (see `supabase/migrations/`):

```
users ─┬─ donors      (org type, verified flag, location)
       ├─ ngos        (capacity, accepted categories, reliability, location)
       └─ volunteers  (vehicle type, availability, location)

donations ──▶ assignments ──▶ status_events (append-only audit)

emergency_requests          notifications
```

Key enums: `user_role`, `org_type`, `food_category`, `storage_condition`, `packaging_type`, `donation_status` (8 states), `assignment_status`, `vehicle_type`, `emergency_status`.

Migrations run in order:

| File | Contents |
|---|---|
| `0001_extensions_and_enums.sql` | PostGIS extension + all enum types |
| `0002_tables.sql` | All 9 tables with `geography(Point)` columns |
| `0003_indexes_and_rpc.sql` | GiST spatial indexes + nearby-NGO RPC |
| `0004_rls_and_storage.sql` | Row-Level Security policies + photo storage bucket |

## User Roles

| Role | Can do |
|---|---|
| **Donor** | List donations, upload photos, track pickup status, view own impact stats |
| **NGO** | Browse/claim donations, request volunteers, verify deliveries, post emergency requests |
| **Volunteer** | Accept pickup assignments, update transit status (picked up → delivered) |
| **Government** | Read-only analytics across the region (food-security planning) |
| **Admin** | Verify donor/NGO organisations, moderate listings, manage users |

## Monorepo Layout

| Folder | What | Hosting (free tier) |
|---|---|---|
| `frontend/` | React + TypeScript + Vite + Tailwind + Leaflet SPA | Vercel |
| `backend/` | NestJS (TypeScript) REST API — 8 feature modules | Render |
| `ml-service/` | Python FastAPI — spoilage, ranking, forecasting | Render |
| `shared/` | Zod schemas + shared TypeScript types | (library) |
| `supabase/` | SQL migrations (Postgres + PostGIS), seed data | Supabase |

Backend feature modules: `auth`, `donations`, `matching`, `assignments`, `emergency`, `notifications`, `analytics`, `admin`.

## Local Setup

**Prerequisites:** Node 20+, Python 3.11+, a free [Supabase](https://supabase.com) project.

### 1. Database

Run the migrations **in order** in the Supabase SQL editor:

```
supabase/migrations/0001_extensions_and_enums.sql
supabase/migrations/0002_tables.sql
supabase/migrations/0003_indexes_and_rpc.sql
supabase/migrations/0004_rls_and_storage.sql
```

### 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env   # fill in Supabase URL / keys (see Environment Variables)
npm install
npm run start:dev      # http://localhost:3000  — Swagger UI at /docs
```

### 3. ML service (FastAPI)

```bash
cd ml-service
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
# (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000               # http://localhost:8000/docs
```

### 4. Frontend (React)

```bash
cd frontend
cp .env.example .env   # fill in Supabase + API URLs
npm install
npm run dev            # http://localhost:5173
```

## Running with Docker

One command brings up all three services (frontend on **:8080**, backend on **:3000**, ML on **:8000**):

```bash
# Create a .env in the repo root with the variables listed below, then:
docker compose up --build
```

Compose handles service ordering via health checks — the backend waits for the ML service, the frontend waits for the backend. The database stays on hosted Supabase (no local Postgres container needed).

## Environment Variables

### Root `.env` (for Docker Compose) / `backend/.env`

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API (⚠️ server-side only — never expose to the browser) |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret |
| `ML_SERVICE_URL` | `http://localhost:8000` locally, `http://ml-service:8000` in Compose |
| `FRONTEND_ORIGIN` | CORS allowlist — `http://localhost:5173` (dev) or `:8080` (Docker) |
| `PORT` / `NODE_ENV` | `3000` / `development` |

### `frontend/.env`

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for the browser — RLS protects the data) |
| `VITE_API_URL` | `http://localhost:3000/api/v1` |

## API Overview

Full interactive documentation lives at **`/docs`** (Swagger) on the backend and **`/docs`** (OpenAPI) on the ML service. The surface at a glance:

```
Backend  (base: /api/v1)
  auth/           session bootstrap, profile completion
  donations/      CRUD + photo upload + lifecycle transitions
  matching/       ranked NGO candidates for a donation
  assignments/    volunteer offer / accept / pickup / deliver
  emergency/      urgent NGO requests + donor responses
  notifications/  list, mark-read (clickable deep links)
  analytics/      impact metrics, leaderboards, forecast panel
  admin/          org verification, moderation

ML service
  POST /spoilage/predict   → { predicted_expiry_at, confidence, rationale }
  POST /rank/ngos          → ranked candidates with per-signal score breakdown
  POST /forecast/demand    → hourly demand estimates per area
```

## Free-Tier Hosting Notes

Things you *will* hit running this on free tiers:

1. **Render free web services sleep after ~15 min idle.** First request after that takes ~30–50 s (cold start). The frontend shows a *"waking server…"* state for this.
2. **Supabase free tier:** 500 MB database cap, and **projects pause after 1 week of inactivity** (wake with one click in the dashboard). Before a demo, open the Supabase dashboard to make sure the project is awake.
3. **Vercel** free tier is effectively unlimited for a static SPA like this.

See **[`DEPLOYMENT.md`](DEPLOYMENT.md)** for a full from-scratch guide to deploying on Vercel + Render + Supabase.

## Roadmap

- [ ] Swap rule-based spoilage model for a trained regressor (XGBoost/LightGBM) on pickup-outcome data
- [ ] Learning-to-rank NGO matching from accept/decline history
- [ ] Per-area Holt-Winters / LightGBM demand forecasting (needs ~3 months of history)
- [ ] Route optimisation for multi-pickup volunteer runs
- [ ] Push notifications (Web Push) alongside in-app notifications
- [ ] Mobile app (React Native) sharing the `shared/` schema layer
- [ ] Multi-language support (Bangla + English)

---

**Built with the goal of making every plate of surplus food someone's next meal.** 🌍
