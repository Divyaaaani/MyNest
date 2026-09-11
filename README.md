# myNest — Find PGs, Roommates & Rent

A full-stack web app for students to **find PG accommodation near their college**, **match with roommates**, and **track shared rent & bills** — with a separate dashboard for PG owners to manage tenants, requests, and collections.

Live concept: search by college → compare PGs on a map → join a PG group → pay rent online together.

## ✨ Features

- **PG search** — by college, radius, budget, and gender, with distance-sorted results + Leaflet map
- **PG detail pages** — photos, facility checklist, owner contact (call/WhatsApp), roommate requests, rent requests
- **Roommate matching** — post a request at a PG or apply to join one; community personals board with comments
- **Rent online** — simulated UPI payment flow, monthly cycles, per-member dues, collection progress
- **Owner dashboard** — listings, tenants, rent/bill tracking, accept/reject requests, add tenants
- **Auth** — JWT login/signup (student + owner roles), Zod-validated, rate-limited
- **Dark mode** — system-aware toggle with a full themed design system
- **Real listings importer** — pulls actual PGs near colleges from the Google Places API

## 🛠 Tech stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 19, Vite 8, React Router 7, Bootstrap 5, Leaflet, react-icons |
| Backend  | Node 20+, Express 5, helmet, rate-limit, morgan, Zod, JWT, multer |
| Database | PostgreSQL 16 (Docker locally; Neon/Supabase hosted for prod)     |

## 📁 Structure

```
mynest/
├── client/           # React + Vite frontend
│   └── src/          # pages, components, api.js, styles
├── server/           # Express API
│   ├── routes/       # auth, pgs, groups, roommates, community, owner, ...
│   ├── middleware/   # JWT auth, Zod validation
│   └── scripts/      # fetch-real-pgs, add-fallback-photos, migrate-mysql-to-pg
├── db/               # schema.pg.sql, seed.pg.sql (+ legacy MySQL files)
├── render.yaml       # Render deploy blueprint (backend)
└── start-servers.bat # double-click to run everything locally (Windows)
```

## 🚀 Run locally

**Prerequisites:** Node 20+, Docker Desktop.

```powershell
# 1. Start Postgres
docker run -d --name mynest-pg -e POSTGRES_PASSWORD=dev_pw -e POSTGRES_DB=mynest `
  -p 5432:5432 -v mynest-pgdata:/var/lib/postgresql/data postgres:16-alpine

# 2. Create schema + seed
docker cp db/schema.pg.sql mynest-pg:/tmp/schema.pg.sql
docker exec mynest-pg psql -U postgres -d mynest -f /tmp/schema.pg.sql
docker cp db/seed.pg.sql mynest-pg:/tmp/seed.pg.sql
docker exec mynest-pg psql -U postgres -d mynest -f /tmp/seed.pg.sql

# 3. Configure + install
#    copy server/.env.example values into server/.env (see table below)
cd server; npm install
cd ../client; npm install

# 4. Run (or just double-click start-servers.bat from the project root)
cd ../server; node index.js      # API on http://localhost:5000
cd ../client; npm run dev        # site on http://localhost:5173
```

### Environment (`server/.env`)

| Variable          | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `PG_HOST/PORT/USER/PASSWORD/DATABASE` | Postgres connection       |
| `JWT_SECRET`      | Token signing secret (long random string)|
| `PORT`            | API port (default 5000)                  |
| `CLIENT_URL`      | Frontend origin for CORS (prod only)     |
| `GOOGLE_PLACES_KEY` | Real-listings importer (optional)      |

### Test accounts (seeded)

| Role    | Email                  | Password   |
| ------- | ---------------------- | ---------- |
| Owner   | ananya@example.com     | ananya123  |
| Student | rohan@example.com      | rohan123   |

### Useful scripts

```powershell
cd server
node scripts/fetch-real-pgs.js     # import real PGs near colleges (needs GOOGLE_PLACES_KEY)
node scripts/add-fallback-photos.js # curated photos for listings without any
```

## 🌍 Deploy (free)

- **Database** → Neon (SQL Editor: run `db/schema.pg.sql`, then `db/seed.pg.sql`)
- **Backend** → Render web service, root `server`, `npm install` / `node index.js` (+ env vars)
- **Frontend** → Vercel project, root `client`, env `VITE_API_URL=https://<api>/api`
- Then set `CLIENT_URL` on Render to the Vercel URL.

## 📝 Notes

- Owner photo uploads store to `server/public/uploads` locally; use Cloudinary (or any object storage) in production — the swap point is marked in `server/routes/properties.js`.
- Free-tier hosting sleeps when idle; first visit after idle can take ~1 minute to wake.
