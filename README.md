<div align="center">

# 🦆 Duck Analytics

**An open-source analytics platform for MongoDB.**
Build dashboards, explore data visually, and share insights — without writing a single aggregation pipeline.

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native_Driver-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [What Makes Duck Analytics Different](#-what-makes-duck-analytics-different)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Production Deployment](#-production-deployment)
- [Typical Usage Flow](#-typical-usage-flow)
- [Repository Structure](#-repository-structure)
- [Scripts Reference](#-scripts-reference)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 About

**Duck Analytics** is a self-hosted, Metabase-inspired analytics platform built **natively for MongoDB**. It lets teams connect to one or more MongoDB clusters, build **Questions** (visual queries) without writing aggregation pipelines by hand, and compose them into **interactive dashboards** with drag-and-resize widgets.

Application metadata (users, dashboards, queries, data sources) lives in **PostgreSQL**, while the actual business data stays in **your own MongoDB**. Connection strings are encrypted at rest with **AES-256-GCM** and never leave your infrastructure.

> Think of it as "Metabase for MongoDB" — focused, modern, and shipped as a single Docker container.

---

## ✨ Features

### 📊 Dashboards
- Drag, drop, and resize widgets on a responsive grid layout
- Mix multiple chart types on the same board
- Persistent layouts — saved per user and dashboard

### 🔎 Visual Query Builder (Questions)
- Build aggregation pipelines without writing MongoDB syntax
- Composable stages: `$match → $group → $sort → $limit → $project`
- Live preview of the compiled pipeline and results
- Collection/field introspection from your MongoDB data sources

### 📈 Chart Types
- **Table** — raw tabular view
- **Bar Chart**
- **Line Chart**
- **Pie Chart**
- **KPI** (single-value cards)

### 🔐 Security & Multi-tenancy
- JWT authentication with Passport
- Per-user data isolation on all `/v1/*` routes
- **AES-256-GCM encryption** for connection strings and secrets
- Strict runtime env validation with Zod — the app refuses to start with bad config

### 🗄️ Data Sources
- Register multiple MongoDB connections per user
- Automatic schema introspection (collections, fields, types)
- Connection pooling handled transparently by the backend

### 🎨 Polished UI
- Built on **shadcn/ui (nova preset)** + **Tailwind CSS v4**
- Light/dark theme out of the box
- File-based routing with **TanStack Router** and cached data fetching with **TanStack Query**

### 🧪 Observability
- System logs model for auditing user actions
- Structured dashboard & component models for clean extension

---

## 🧠 What Makes Duck Analytics Different

| | Duck Analytics | Typical BI Tools |
|---|---|---|
| **Native to MongoDB** | ✅ First-class aggregation pipeline compiler | ⚠️ Usually SQL-first, Mongo via connectors |
| **Visual pipeline builder** | ✅ No `$match`/`$group` syntax required | ❌ Often requires raw query language |
| **Single-container deployment** | ✅ Frontend + backend + Nginx in one image | ❌ Multi-service deployments |
| **Encrypted connection storage** | ✅ AES-256-GCM at rest | ⚠️ Plaintext or external vault required |
| **Runtime-validated config** | ✅ Zod-validated env — fail fast | ❌ Silent misconfiguration |
| **Modern stack** | ✅ NestJS 11, React 19, Prisma 7, Vite 8 | ⚠️ Often legacy stacks |
| **Self-hostable & open source** | ✅ MIT, your data stays put | ⚠️ Often SaaS-only |

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                          │
│          React 19 · Vite · TanStack Router & Query             │
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   Nginx (reverse proxy)                        │
│         /v1/*  ──►  NestJS API     /*  ──►  static SPA         │
└──────────────┬───────────────────────────┬─────────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│     NestJS Backend       │   │       PostgreSQL (metadata)     │
│  · JWT auth              │──►│  users · dashboards · queries   │
│  · QueryBuilderService   │   │  data_sources (AES-GCM cipher)  │
│  · MongodbService        │   └─────────────────────────────────┘
└──────────────┬───────────┘
               │ encrypted connection strings
               ▼
┌────────────────────────────────────────────────────────────────┐
│                 MongoDB (your business data)                   │
│           queried via compiled aggregation pipelines           │
└────────────────────────────────────────────────────────────────┘
```

| Layer | Folder | Role |
|---|---|---|
| **Frontend** | `duck-analytics-front/` | SPA: dashboards, query builder, charts, auth |
| **Backend** | `duck-analytics-backend/` | REST API `/v1/*`, Prisma, MongoDB driver, pipeline compiler |
| **App DB** | `docker-compose.yaml` | PostgreSQL 18 for internal metadata |
| **Analyzed data** | External MongoDB | Registered per user as a *Data Source* |

---

## 🛠 Tech Stack

### Backend
- **NestJS 11** · **TypeScript** · **SWC** compiler
- **Prisma 7** with `prisma-client` generator + `@prisma/adapter-pg`
- **PostgreSQL 18** for metadata
- **MongoDB native driver** for introspection & aggregations
- **JWT + Passport** for auth
- **Zod** for env and DTO validation
- **AES-256-GCM** via Node `crypto`

### Frontend
- **React 19** · **Vite 8** · **TypeScript**
- **TanStack Router** (file-based) + **TanStack Query**
- **shadcn/ui** (Radix) with the **nova** preset
- **Tailwind CSS v4**
- **recharts** for charts
- **react-grid-layout v2** for dashboard grid
- **Axios** + **next-themes**

### Infrastructure
- **Docker** multi-stage build
- **Nginx** as SPA server + reverse proxy
- **Supervisord** for in-container process management

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (current LTS recommended) with `npm` or `pnpm`
- **Docker** + **Docker Compose**
- A **MongoDB** instance (local or remote) to register as a data source

### 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d
```

Postgres is exposed on host port **`5671`** (mapped to `5432` in the container). Credentials live in `docker-compose.yaml`.

### 2. Run the Backend

```bash
cd duck-analytics-backend
cp .env.example .env
# Set JWT_SECRET and ENCRYPTION_KEY (must be 64 hex chars = 32 bytes)
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API available at **`http://localhost:3000`**.

### 3. Run the Frontend

```bash
cd duck-analytics-front
cp .env.example .env
npm install
npm run dev
```

App available at **`http://localhost:5173`**.

---

## ⚙️ Configuration

### Backend (`duck-analytics-backend/.env`)

Validated at runtime in `src/env.ts`. The process refuses to start if any required variable is missing or malformed.

| Variable | Required | Description |
|---|:---:|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret used to sign JWTs |
| `ENCRYPTION_KEY` | ✅ | **Exactly 64 hex chars** — AES-256-GCM master key |
| `PORT` | ✅ | HTTP port (default `3000`) |

Generate a secure encryption key:

```bash
openssl rand -hex 32
```

### Frontend (`duck-analytics-front/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the API (default `http://localhost:3000`) |

---

## 📦 Production Deployment

Duck Analytics ships as a **single all-in-one Docker image** bundling the frontend, backend, and Nginx — Metabase-style. Expose one port and you're done.

### Quick Start

```bash
# 1. Configure environment variables
cp .env.production.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY and POSTGRES_PASSWORD

# 2. Start everything
docker compose -f docker-compose.prod.yml up -d

# 3. Open the app
# http://localhost:3000
```

### Production Environment Variables

Defined in the root `.env`, consumed by `docker-compose.prod.yml`:

| Variable | Required | Description |
|---|:---:|---|
| `JWT_SECRET` | ✅ | JWT signing secret — **never leave the default** |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars (32 bytes) for AES-256-GCM. Generate with `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | ⚪ | PostgreSQL password (default: `duck`) |
| `PORT` | ⚪ | Host port to expose (default: `3000`) |

See [`.env.production.example`](.env.production.example) for the full template.

### How the Container Works

```
User :3000 ──► Nginx (app container)
                 ├── /v1/*   ──► Node.js :3001 (NestJS backend)
                 └── /*      ──► static files (React frontend)

               PostgreSQL :5432 (db container, volume: pgdata)
```

- **Nginx** serves the frontend bundle and reverse-proxies `/v1/*` to the backend
- **Supervisord** supervises Nginx + Node.js inside the same container
- **Migrations** run automatically on startup (`prisma migrate deploy`)
- **Postgres data** persists in a named Docker volume (`pgdata`)

### Operational Commands

```bash
# Tail logs
docker compose -f docker-compose.prod.yml logs -f app

# Rebuild after code changes
docker compose -f docker-compose.prod.yml up -d --build

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop AND wipe database volume (destructive!)
docker compose -f docker-compose.prod.yml down -v
```

### Production Checklist

- [ ] Rotate `JWT_SECRET` to a strong random value
- [ ] Generate a fresh `ENCRYPTION_KEY` (`openssl rand -hex 32`) — **back it up**, losing it means losing access to every stored data-source credential
- [ ] Change `POSTGRES_PASSWORD`
- [ ] Put a TLS-terminating proxy (Caddy, Traefik, Cloudflare, etc.) in front of port `3000`
- [ ] Schedule backups of the `pgdata` volume
- [ ] Restrict network access from the container to only the MongoDB clusters you intend to analyze

---

## 🔄 Typical Usage Flow

1. **Sign up / Sign in** at `/sign-up` or `/sign-in`
2. **Register a Data Source** pointing to your MongoDB cluster
3. **Create Questions** — visual queries over your collections
4. **Build Dashboards** — arrange questions as resizable widgets
5. **Share & iterate** — refine queries and layouts over time

---

## 🗂 Repository Structure

```
duck-analytics/
├── docker-compose.yaml          # Dev PostgreSQL
├── docker-compose.prod.yml      # Prod: app + PostgreSQL (all-in-one)
├── Dockerfile                   # Multi-stage build (frontend + backend + nginx)
├── docker/                      # Production container configs
│   ├── nginx.conf               # Reverse proxy + SPA fallback
│   ├── supervisord.conf         # Manages nginx + node
│   └── entrypoint.sh            # Migrations + startup
├── .env.production.example      # Production env template
├── duck-analytics-backend/      # NestJS + Prisma 7 + MongoDB driver
├── duck-analytics-front/        # Vite + React + TanStack + shadcn/ui
├── FUTURE_FEATURES.md           # Informal roadmap
└── README.md
```

Per-package documentation:

- **Backend:** `duck-analytics-backend/AGENTS.md`, `duck-analytics-backend/CLAUDE.md`
- **Frontend:** `duck-analytics-front/AGENTS.md`, `duck-analytics-front/CLAUDE.md`

---

## 🧾 Scripts Reference

| Package | Command | Purpose |
|---|---|---|
| Backend | `npm run start:dev` | Dev server with watch |
| Backend | `npm run build` | Compile with SWC → `dist/` |
| Backend | `node dist/main.js` | Run compiled output |
| Backend | `npx prisma generate` | Regenerate Prisma client |
| Backend | `npx prisma migrate dev` | Create/apply a migration |
| Backend | `npx prisma migrate deploy` | Apply migrations (production) |
| Backend | `npm run lint` | ESLint with auto-fix |
| Backend | `npm test` / `npm run test:e2e` | Unit / E2E tests |
| Frontend | `npm run dev` | Vite dev server (`:5173`) |
| Frontend | `npm run build` | Production build |
| Frontend | `npm run preview` | Preview production build |
| Frontend | `npm run lint` | ESLint |

---

## 🛣 Roadmap

See [`FUTURE_FEATURES.md`](FUTURE_FEATURES.md) for the informal roadmap. High-level directions:

- Dashboard sharing & public links
- Scheduled report delivery
- More chart types (area, scatter, heatmap)
- Query parameters & dashboard filters
- Role-based access control

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit your changes
4. Open a Pull Request

Please read each package's `CLAUDE.md` / `AGENTS.md` before proposing architectural changes — they document the conventions that keep the codebase coherent.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Built with 🦆 for developers who love MongoDB.**

</div>
