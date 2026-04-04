# AGENTS.md — duck-analytics (raiz)

Guia para agentes de IA colaborarem neste monorepo sem quebrar fluxos de frontend/backend.

## Escopo

Este `AGENTS.md` cobre o nível de **orquestração do monorepo**.  
Detalhes de implementação de cada app estão em:

- `duck-analytics-front/AGENTS.md`
- `duck-analytics-backend/AGENTS.md`

Quando houver conflito, os AGENTS específicos de cada pacote prevalecem dentro de suas pastas.

## Estrutura do repositório

- `duck-analytics-front/`: SPA React + Vite
- `duck-analytics-backend/`: API NestJS + Prisma + PostgreSQL + MongoDB
- `docker-compose.yaml`: PostgreSQL local do app
- `docs/`: documentação auxiliar
- `FUTURE_FEATURES.md`: backlog/ideias

## Stack e runtime

- Node.js (LTS)
- pnpm (preferencial no monorepo) ou npm por pacote
- Docker/Compose para banco local

Serviços locais padrão:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL (container): host `localhost:5671`

## Setup rápido (local)

1. Subir banco:
```bash
pnpm docker:up
```
2. Backend:
```bash
cd duck-analytics-backend
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm start:dev
```
3. Frontend:
```bash
cd duck-analytics-front
cp .env.example .env
pnpm install
pnpm dev
```

Opcional (raiz, tudo junto):

```bash
pnpm dev
```

## Scripts importantes (raiz)

- `pnpm dev`: sobe DB e roda backend + frontend em paralelo
- `pnpm docker:up`: inicia PostgreSQL
- `pnpm docker:down`: derruba PostgreSQL
- `pnpm install:all`: instala dependências dos dois pacotes

## Regras de trabalho para agentes

- Fazer mudanças no pacote correto (`duck-analytics-front` ou `duck-analytics-backend`), evitando editar arquivos de outro pacote sem necessidade.
- Não editar arquivos gerados automaticamente, especialmente:
  - `duck-analytics-front/src/routeTree.gen.ts`
  - `duck-analytics-backend/src/generated/prisma/*`
- Alterou schema Prisma? Rodar `pnpm db:generate` no backend.
- Alterou contrato de API? Atualizar tipos/consumo no frontend na mesma tarefa, quando aplicável.
- Preferir mudanças pequenas e incrementais; evitar refactors grandes sem pedido explícito.

## Validação antes de finalizar

Rodar validações mínimas no(s) pacote(s) alterado(s):

- Frontend: `pnpm lint` e `pnpm build`
- Backend: `pnpm lint` e `pnpm test`
- Se mexer em banco/Prisma: `pnpm db:generate` e migração aplicável

Se não for possível executar alguma validação, registrar claramente o que ficou pendente.

## Convenções de commit (recomendado)

- Commits focados por tema (frontend, backend, infra)
- Mensagem curta e descritiva (ex.: `feat(front): add dashboard filter relationship panel`)
- Evitar misturar mudança funcional e formatação ampla no mesmo commit

## Referências rápidas

- Arquitetura geral e fluxo de uso: `README.md` (raiz)
- Convenções frontend: `duck-analytics-front/AGENTS.md`
- Convenções backend: `duck-analytics-backend/AGENTS.md`
