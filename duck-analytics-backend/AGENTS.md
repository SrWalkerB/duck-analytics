# AGENTS.md — duck-analytics-backend

Guia de arquitetura para agentes de IA trabalhando neste repositório.

---

## Stack

- **NestJS 11** com **SWC** (não tsc) para compilação
- **Prisma 7** com o novo generator `prisma-client` + driver adapter `@prisma/adapter-pg`
- **PostgreSQL** via Docker Compose (porta 5671) para dados internos
- **MongoDB** (driver nativo) para as data sources dos usuários
- **Zod** para validação de DTOs e variáveis de ambiente
- **JWT + Passport** para autenticação

---

## Estrutura de pastas

```
src/
  main.ts                        # Bootstrap; import 'dotenv/config' obrigatório aqui
  app.module.ts                  # Importa todos os módulos
  env.ts                         # Zod parse de process.env — use sempre env.FIELD
  lib/
    prisma/                      # PrismaModule (global) + PrismaService
    crypto/encryption.service.ts # AES-256-GCM
    mongodb/
      mongodb.service.ts         # Pool de conexões MongoDB
      mongodb-introspection.service.ts
  modules/
    auth/                        # JWT auth
    data-sources/
    queries/
      query-builder.service.ts   # Compilador visual config → aggregation pipeline
    components/
    dashboards/
    filters/
    folders/
    ai/
  generated/prisma/              # Gerado por `prisma generate` — NÃO editar
```

---

## Padrão de módulo

Todo módulo segue a mesma estrutura: `module.ts` → `controller.ts` → `service.ts` → Prisma.

### controller.ts

```typescript
@Controller('v1/recurso')
@UseGuards(JwtAuthGuard)         // toda rota autenticada leva isso no nível da classe
export class RecursoController {
  constructor(private readonly service: RecursoService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: object) {  // ← dto: object, sem tipo
    return this.service.create(userId, dto as CreateRecursoDto); // ← cast aqui
  }
}
```

**Por que `@Body() dto: object`?** O TypeScript com `isolatedModules` + `emitDecoratorMetadata` lança TS1272 quando um type alias importado é usado diretamente como parâmetro de decorator. A solução padrão deste projeto é declarar `object` e fazer o cast na chamada do service.

### service.ts

```typescript
import type { CreateRecursoDto } from './dto/create-recurso.dto'; // import type

@Injectable()
export class RecursoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecursoDto) {
    return this.prisma.recurso.create({
      data: {
        name: dto.name,
        configuration: dto.configuration as object, // campos Json precisam de cast
        userId,
      },
    });
  }

  // Updates usam spread condicional para evitar conflito XOR do Prisma
  async update(id: string, userId: string, dto: UpdateRecursoDto) {
    return this.prisma.recurso.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration as object }),
      },
    });
  }
}
```

### dto/create-recurso.dto.ts

```typescript
import { z } from 'zod';

export const createRecursoSchema = z.object({
  name: z.string().min(1),
  folderId: z.string().optional(),
});

export type CreateRecursoDto = z.infer<typeof createRecursoSchema>;
```

DTOs são Zod schemas. O tipo é inferido com `z.infer`. A validação runtime não é aplicada automaticamente pelo NestJS — o service recebe o objeto já castado e confia que o frontend enviou os dados corretos. Para validar explicitamente, chame `schema.parse(dto)` no service.

### module.ts

```typescript
@Module({
  imports: [OutroModuleSeNecessario],
  controllers: [RecursoController],
  providers: [RecursoService],
  exports: [RecursoService],  // exportar se outros módulos precisarem
})
export class RecursoModule {}
```

Após criar o módulo, adicionar em `app.module.ts`.

---

## Autenticação

- **Guard:** `@UseGuards(JwtAuthGuard)` — aplica no nível da classe para proteger todas as rotas do controller
- **User ID:** `@CurrentUser() userId: string` — injeta o `sub` do JWT (UUID do usuário)
- **Todos os dados são filtrados por userId** — toda query Prisma inclui `where: { userId, ... }`

---

## Prisma 7 — peculiaridades importantes

### Sem `url` no schema.prisma

O Prisma 7 com o generator `prisma-client` não aceita `url = env(...)` no schema. A URL vive em dois lugares:

1. **`prisma.config.ts`** — para os comandos CLI (`migrate`, `generate`)
2. **`PrismaService` constructor** — passada via driver adapter:

```typescript
// src/lib/prisma/prisma.service.ts
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
super({ adapter });
```

### Geração e migração

```bash
npx prisma generate          # após mudar schema.prisma
npx prisma migrate dev       # cria e aplica migration
```

O client gerado fica em `src/generated/prisma/` — não editar manualmente.

### Campos Json

Campos `Json` do Prisma precisam de cast ao escrever: `configuration: dto.configuration as object`. Sem o cast, o TypeScript reclama de incompatibilidade de tipo com `InputJsonValue`.

---

## Soft delete

Modelos com `deletedAt DateTime?` usam soft delete. Sempre filtrar nas queries:

```typescript
this.prisma.recurso.findMany({ where: { userId, deletedAt: null } });
```

Para deletar: `update({ where: { id }, data: { deletedAt: new Date() } })`.

---

## EncryptionService — dados sensíveis

MongoDB connection strings e AI API keys são criptografados em repouso com AES-256-GCM antes de salvar no PostgreSQL.

```typescript
// Ao salvar:
const encrypted = this.encryption.encrypt(dto.connectionString);

// Ao usar (MongoDBService faz isso automaticamente):
const plaintext = this.encryption.decrypt(ds.connectionString);
```

`ENCRYPTION_KEY` no `.env` deve ter exatamente 64 caracteres hex (= 32 bytes).

---

## MongoDBService — conexões externas

Gerencia um pool de `MongoClient` em memória, indexado por `connectionString + database`. Recebe a connection string **já criptografada** (como está no banco) e decripta internamente.

```typescript
// Uso nos services:
const db = await this.mongodb.getDb(ds.connectionString, ds.database);
const collections = await this.introspection.listCollections(db);
```

Nunca instanciar `MongoClient` diretamente nos services — usar sempre o `MongoDBService`.

---

## QueryBuilderService

Compila um `QueryConfiguration` (JSON salvo em `Query.configuration`) em um aggregation pipeline do MongoDB:

**Ordem das stages:** `$match` → `$group` → `$project` → `$sort` → `$limit`

```typescript
const pipeline = this.queryBuilder.compile(config, injectedFilters);
await db.collection(query.collection).aggregate(pipeline).toArray();
```

O parâmetro `injectedFilters` é usado pelos filtros de dashboard para injetar condições adicionais sem alterar a query salva.

---

## Variáveis de ambiente

Sempre importar `env` de `src/env.ts` — nunca acessar `process.env` diretamente nos modules:

```typescript
import { env } from '../../env';
const secret = env.JWT_SECRET;
```

Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `PORT`.

---

## Compilação

O projeto usa **SWC** (não tsc) via `nest-cli.json`. O motivo: o Prisma 7 gerado usa `import.meta.url` no TypeScript, que o compilador tsc não transforma corretamente para CJS. O SWC substitui por `__filename` automaticamente.

O output do build vai para `dist/` (não `dist/src/`). O entry point é `node dist/main.js`.
