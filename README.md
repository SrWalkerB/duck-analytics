# Duck Analytics

Plataforma de **analytics** com **dashboards** e **questions** (queries visuais) sobre dados em **MongoDB**, com metadados e usuários em **PostgreSQL**. Monorepo com API **NestJS** e SPA **React (Vite)**.

---

## Visão geral da arquitetura

| Camada | Pasta | Papel |
|--------|--------|--------|
| **Frontend** | `duck-analytics-front/` | UI: dashboards com grid arrastável/redimensionável, editor de queries, gráficos, autenticação JWT |
| **Backend** | `duck-analytics-backend/` | API REST `/v1/*`, Prisma + PostgreSQL, conexões MongoDB por data source, compilação de queries em aggregation pipelines |
| **Banco app** | Docker (`docker-compose.yaml`) | PostgreSQL 18 para dados internos (usuários, dashboards, queries, etc.) |
| **Dados analisados** | MongoDB (externo) | Informado pelo usuário ao cadastrar **Data Sources**; string de conexão cifrada no PostgreSQL |

---

## Pré-requisitos

- **Node.js** (recomendado: LTS atual) — use **npm** ou **pnpm** conforme sua preferência
- **Docker** + **Docker Compose** (para PostgreSQL)
- **MongoDB** acessível (local ou remoto) para conectar como data source pela aplicação

---

## Início rápido

### 1. Subir o PostgreSQL

Na raiz do repositório `duck-analytics/`:

```bash
docker compose up -d
```

Por padrão o Postgres expõe a porta **`5671`** no host (mapeada para `5432` no container). Usuário/senha/DB estão em `docker-compose.yaml`.

### 2. Backend

```bash
cd duck-analytics-backend
cp .env.example .env
# Ajuste JWT_SECRET e ENCRYPTION_KEY (64 caracteres hex = 32 bytes)
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

A API sobe em **`http://localhost:3000`** (ou a porta definida em `PORT` no `.env`).

### 3. Frontend

```bash
cd duck-analytics-front
cp .env.example .env
npm install
npm run dev
```

O Vite sobe em **`http://localhost:5173`**. A URL da API vem de `VITE_API_URL` (padrão: `http://localhost:3000`).

---

## Variáveis de ambiente

### Backend (`duck-analytics-backend/.env`)

Validadas em runtime por `src/env.ts`. Obrigatórias:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL (ex.: alinhada ao `docker-compose`) |
| `JWT_SECRET` | Segredo para assinatura JWT |
| `ENCRYPTION_KEY` | **Exatamente 64 caracteres hex** — AES-256-GCM para cifrar connection strings e chaves sensíveis |
| `PORT` | Porta HTTP (padrão `3000`) |

Veja o modelo em `duck-analytics-backend/.env.example`.

### Frontend (`duck-analytics-front/.env`)

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | Base URL da API (ex.: `http://localhost:3000`) |

Veja `duck-analytics-front/.env.example`.

---

## Produção com Docker

O deploy de produção empacota **frontend + backend + Nginx** em um único container, estilo Metabase. Basta expor uma porta e acessar.

### Início rápido

```bash
# 1. Configure as variáveis de ambiente
cp .env.production.example .env
# Edite o .env — troque JWT_SECRET, ENCRYPTION_KEY e POSTGRES_PASSWORD

# 2. Suba tudo
docker compose -f docker-compose.prod.yml up -d

# 3. Acesse
# http://localhost:3000
```

### Variáveis de ambiente (produção)

Definidas no `.env` da raiz (lido pelo `docker-compose.prod.yml`):

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `JWT_SECRET` | Sim | Segredo para assinatura JWT. **Troque o valor padrão!** |
| `ENCRYPTION_KEY` | Sim | 64 caracteres hex (32 bytes) para AES-256-GCM. Gere com `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Não | Senha do PostgreSQL (padrão: `duck`) |
| `PORT` | Não | Porta exposta no host (padrão: `3000`) |

> Veja o modelo completo em [`.env.production.example`](.env.production.example).

### Como funciona

```
Usuário :3000 ──► Nginx (container app)
                    ├── /v1/*   ──► Node.js :3001 (backend NestJS)
                    └── /*      ──► arquivos estáticos (frontend React)

                  PostgreSQL :5432 (container db)
```

- **Nginx** serve o frontend estático e faz proxy reverso de `/v1/*` para o backend
- **Supervisord** gerencia Nginx e Node.js dentro do container
- **Migrations** rodam automaticamente no startup (`prisma migrate deploy`)
- **Dados do Postgres** ficam em um volume Docker (`pgdata`), persistindo entre restarts

### Comandos úteis

```bash
# Ver logs em tempo real
docker compose -f docker-compose.prod.yml logs -f app

# Rebuild após mudanças no código
docker compose -f docker-compose.prod.yml up -d --build

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Parar e apagar dados do banco (cuidado!)
docker compose -f docker-compose.prod.yml down -v
```

---

## Estrutura do repositório

```
duck-analytics/
├── docker-compose.yaml          # PostgreSQL para desenvolvimento
├── docker-compose.prod.yml      # Produção: app + PostgreSQL (tudo-em-um)
├── Dockerfile                   # Multi-stage build (frontend + backend + nginx)
├── docker/                      # Configs do container de produção
│   ├── nginx.conf               # Proxy reverso + SPA
│   ├── supervisord.conf         # Gerencia nginx + node
│   └── entrypoint.sh            # Migrations + startup
├── .env.production.example      # Modelo de variáveis para produção
├── duck-analytics-backend/      # NestJS + Prisma 7 + MongoDB driver
├── duck-analytics-front/        # Vite + React + TanStack Router/Query + shadcn/ui
├── FUTURE_FEATURES.md           # Ideias / roadmap informal
└── README.md                    # Este arquivo
```

Documentação extra por pacote:

- **Backend:** `duck-analytics-backend/AGENTS.md`, `duck-analytics-backend/CLAUDE.md`
- **Frontend:** `duck-analytics-front/AGENTS.md`, `duck-analytics-front/CLAUDE.md`

---

## Stack principal

### Backend

- **NestJS 11**, **Prisma 7** (client gerado em `src/generated/prisma/`), **PostgreSQL**
- **MongoDB** (driver nativo) para introspectar coleções e executar agregações
- **JWT + Passport** para autenticação; rotas autenticadas sob `/v1/`
- **Zod** para validação de `env` e DTOs (padrão do projeto)

### Frontend

- **React 19**, **Vite 8**, **TypeScript**
- **TanStack Router** (rotas em arquivo) + **TanStack Query**
- **shadcn/ui** (Radix) + **Tailwind CSS v4**
- **recharts** para gráficos; **react-grid-layout v2** para layout dos widgets no dashboard
- **Axios** (`src/services/api.ts`) com Bearer token; **next-themes** para tema claro/escuro

---

## Scripts úteis

| Onde | Comando | Uso |
|------|---------|-----|
| Backend | `npm run start:dev` | Desenvolvimento com watch |
| Backend | `npm run build` / `node dist/main.js` | Build e execução em produção |
| Backend | `npx prisma migrate dev` | Migrações locais |
| Backend | `npx prisma generate` | Regenerar client após mudar `schema.prisma` |
| Frontend | `npm run dev` | Dev server |
| Frontend | `npm run build` | Build de produção (`dist/`) |

---

## Fluxo típico de uso

1. Criar conta / entrar (`/sign-up`, `/sign-in`).
2. Cadastrar **Data Sources** apontando para um MongoDB.
3. Criar **Questions** (queries visuais) e componentes de visualização.
4. Montar **Dashboards** com widgets redimensionáveis.

---