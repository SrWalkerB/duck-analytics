# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev        # NestJS with file watching
npm run build            # Compile with SWC via nest build → dist/
node dist/main.js        # Run compiled output (entry point is dist/main.js, NOT dist/src/main.js)

# Prisma
npx prisma generate                        # Regenerate client after schema changes
npx prisma migrate dev --name <name>       # Create and apply a migration
npx prisma migrate deploy                  # Apply migrations in production

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier

# Tests
npm test                 # Jest
npm run test:watch       # Jest in watch mode
npm run test:e2e         # E2E tests (test/jest-e2e.json config)
```

## Architecture

### Prisma 7 + NestJS specifics

This project uses **Prisma 7** with the new `prisma-client` generator (not the legacy `prisma-client-js`). Key implications:

- **No `url` in schema.prisma** — the datasource has no `url` field. The connection URL lives only in `prisma.config.ts` (for Migrate CLI) and is passed via `@prisma/adapter-pg` in `PrismaService` (for the runtime client).
- **PrismaService** (`src/lib/prisma/prisma.service.ts`) passes `new PrismaPg({ connectionString: env.DATABASE_URL })` to `super({ adapter })`.
- **Generated client** is output to `src/generated/prisma/` — do not edit those files; run `prisma generate` to regenerate.
- **SWC compiler** (not tsc) is required because the Prisma 7 generated TypeScript uses `import.meta.url`, which TypeScript's CJS output doesn't transform. SWC handles this correctly.

### Module structure

Every feature follows the same pattern: `module.ts` → `controller.ts` → `service.ts` → Prisma, with DTOs in `dto/`. All routes are prefixed `/v1/`. All authenticated routes use `@UseGuards(JwtAuthGuard)` and inject the user ID with `@CurrentUser() userId: string`.

Shared infrastructure lives in `src/lib/`:
- `prisma/` — global `PrismaModule` (exported and available everywhere)
- `crypto/encryption.service.ts` — AES-256-GCM, used to encrypt MongoDB connection strings and AI API keys at rest
- `mongodb/mongodb.service.ts` — connection pool manager; decrypts the connection string and returns a `Db` instance
- `mongodb/mongodb-introspection.service.ts` — `listCollections()` and `inferSchema()` via `$sample` aggregation

### DTO pattern

DTOs are Zod schemas. To avoid a TypeScript `isolatedModules` + `emitDecoratorMetadata` conflict (TS1272), controllers declare `@Body() dto: object` and cast: `this.service.method(dto as MyDto)`. Services use `import type` for DTO types.

JSON Prisma fields must be cast when writing: `configuration: dto.configuration as object`.

### Env validation

`src/env.ts` uses Zod to parse `process.env` at startup. Import `env` from there instead of accessing `process.env` directly. Required variables: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` (exactly 64 hex chars), `PORT`.

### Query builder

`src/modules/queries/query-builder.service.ts` compiles a `QueryConfiguration` (the visual builder state stored in `Query.configuration`) into a MongoDB aggregation pipeline stored in `Query.pipeline`. The pipeline order is `$match` → `$group` → `$sort` → `$limit` → `$project`.
