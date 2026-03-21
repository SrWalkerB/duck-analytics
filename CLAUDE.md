# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

Monorepo with two packages and a shared Docker Compose:

- `duck-analytics-backend/` — NestJS API (see its own CLAUDE.md for details)
- `duck-analytics-front/` — React + Vite SPA (see its own CLAUDE.md for details)
- `docker-compose.yaml` — PostgreSQL on port `5671` (mapped from 5432), container `duck_analytics_db`

## Infrastructure

```bash
docker compose up -d   # Start PostgreSQL (required before running the backend)
```

PostgreSQL credentials: `docker / docker`, database: `duck_analytics_db`.

## Backend (`duck-analytics-backend/`)

```bash
npm run start:dev        # NestJS with file watching
npm run build            # Compile with SWC → dist/
node dist/main.js        # Run compiled output

npx prisma generate                        # Regenerate client after schema changes
npx prisma migrate dev --name <name>       # Create and apply a migration
npx prisma migrate deploy                  # Apply migrations in production

npm run lint             # ESLint with auto-fix
npm run format           # Prettier
npm test                 # Jest
npm run test:e2e         # E2E tests
```

### Key architecture points

- **Prisma 7** with `prisma-client` generator (not legacy `prisma-client-js`). No `url` in `schema.prisma` — connection lives in `prisma.config.ts` and is passed via `@prisma/adapter-pg` in `PrismaService`.
- Generated Prisma client is in `src/generated/prisma/` — never edit manually.
- **SWC compiler** required (Prisma 7 generated TS uses `import.meta.url`).
- All routes prefixed `/v1/`. Authenticated routes use `@UseGuards(JwtAuthGuard)` + `@CurrentUser() userId: string`.
- DTOs are Zod schemas. Controllers declare `@Body() dto: object` and cast to avoid TS1272.
- `src/env.ts` validates env vars at startup — import `env` from there, never `process.env` directly. Required: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `PORT`.
- Shared infrastructure in `src/lib/`: `PrismaModule`, `EncryptionService` (AES-256-GCM), `MongodbService` (connection pool), `MongodbIntrospectionService`.
- `QueryBuilderService` compiles visual builder state (`QueryConfiguration`) into MongoDB aggregation pipelines (`$match → $group → $sort → $limit → $project`).

## Frontend (`duck-analytics-front/`)

```bash
npm run dev      # Vite dev server on port 5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Key architecture points

- **TanStack Router** with file-based routing. `src/routeTree.gen.ts` is auto-generated — never edit manually.
  - `__root.tsx` — root layout with `<Toaster />`
  - `_authenticated.tsx` — JWT guard + `AppSidebar` layout; redirects to `/sign-in` on missing token
  - `sign-in.tsx` / `sign-up.tsx` — public routes
- **TanStack Query** with `staleTime: 30_000`, 1 retry. All API calls through `src/services/api.ts` (Axios with Bearer token from `localStorage`, 401 → `/sign-in`). Base URL: `VITE_API_URL` (defaults to `http://localhost:3000`).
- **shadcn/ui** with the **nova** preset. Components in `src/components/ui/`. Path alias `@/` → `src/`.
- All shared TypeScript types in `src/types/index.ts` — mirror backend Prisma models and API response shapes.
- Key custom components: `QueryBuilder.tsx` (visual MongoDB aggregation builder), `ChartRenderer.tsx` (recharts for TABLE/BAR_CHART/LINE_CHART/PIE_CHART/KPI), `ComponentEditor.tsx`, `DashboardGrid.tsx` (react-grid-layout v2).
