# Dashboard Filters

Documentacao do sistema de filtros dos dashboards conforme implementado hoje.

---

## Visao Geral

Filtros permitem que o usuario filtre os dados exibidos nos componentes de um dashboard. Cada filtro esta vinculado a uma **collection** e um **campo** de um data source MongoDB, e pode afetar um ou mais componentes do dashboard.

---

## Modelo de Dados

### DashboardFilter (Prisma)

```
id              String      PK
dashboardId     String      FK → Dashboard
label           String      Nome exibido no filtro (ex: "Marca", "Categoria")
type            FilterType  SELECT | MULTI_SELECT | DATE_RANGE | TEXT
field           String      Campo MongoDB fonte dos valores (ex: "name", "brand")
collection      String      Collection MongoDB de onde puxa os valores
dataSourceId    String      FK → DataSource
parentFilterId  String?     FK → DashboardFilter (para cascata)
targetMappings  Json        Array de { componentId, targetField }
```

### targetMappings

Define quais componentes sao afetados pelo filtro e qual campo de cada componente sera filtrado:

```json
[
  { "componentId": "comp-abc", "targetField": "categoryId" },
  { "componentId": "comp-xyz", "targetField": "brand" }
]
```

- `componentId`: ID do Component (nao do DashboardComponent)
- `targetField`: campo na collection da query do componente que recebera o filtro como `$match { [targetField]: { $in: valoresSelecionados } }`

---

## API Backend

### Endpoints

Todos sob `v1/dashboards/:dashboardId/filters`, autenticados com JWT.

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/` | Lista filtros do dashboard |
| POST | `/` | Cria filtro |
| PUT | `/:filterId` | Atualiza filtro |
| DELETE | `/:filterId` | Exclui filtro |
| GET | `/:filterId/values` | Busca valores distintos do campo |

### GET /:filterId/values

Retorna valores distintos do campo configurado via aggregation MongoDB.

**Query params:**
- `page` (default 1)
- `pageSize` (default 20)
- `search` — filtro regex case-insensitive nos valores
- `parentValue` — valor(es) do filtro pai, separados por virgula para multi-select. Usa `$in` quando multiplos.

**Resposta:**
```json
{ "values": ["Nike", "Adidas", ...], "page": 1, "pageSize": 20 }
```

### POST /dashboards/:id/data

Busca dados dos componentes com filtros ativos aplicados.

**Body:**
```json
{ "activeFilters": { "filterId1": ["valor1", "valor2"], "filterId2": ["valor3"] } }
```

O backend monta `QueryFilter[]` por componente baseado no `targetMappings`:
1. Para cada componente, verifica quais filtros o referenciam via targetMappings
2. Para cada filtro ativo com valores selecionados, cria `{ field: targetField, operator: "in", value: selectedValues }`
3. Passa como `injectedFilters` para `QueriesService.execute()`, que prepende um `$match` no pipeline

---

## Cascata (Filtros Pai/Filho)

Um filtro pode ter `parentFilterId` apontando para outro filtro do mesmo dashboard.

**Comportamento:**
- Filtro filho fica desabilitado quando o pai nao tem selecao
- Ao buscar valores do filho, passa `parentValue` com os valores selecionados do pai
- Backend faz `$match` no campo do pai antes de agrupar os valores do filho
- Quando o pai muda, as selecoes dos filhos sao limpas automaticamente (recursivo)

**Exemplo:**
- Filtro pai: "Marca" (collection: `products`, field: `brand`)
- Filtro filho: "Modelo" (collection: `products`, field: `model`, parentFilterId: filtro pai)
- Usuario seleciona Marca = "Nike" → filho busca values com `$match: { brand: "Nike" }` → so mostra modelos da Nike

---

## Frontend

### FilterBar (view mode)

Arquivo: `src/components/dashboard/FilterBar.tsx`

Renderiza acima do grid quando o dashboard tem filtros. Cada filtro vira um dropdown multi-select (Popover com checkboxes e busca).

**Estado:** `activeFilters: Record<filterId, unknown[]>` gerenciado na pagina do dashboard. Incluso no queryKey do TanStack Query para refetch automatico.

### FilterEditorPanel (edit mode)

Arquivo: `src/components/dashboard/FilterEditorPanel.tsx`

Sheet lateral para criar/editar filtros. Fluxo: DataSource → Collection → Campo → Tipo → Pai (opcional) → Componentes alvo com mapeamento de campo.

### Integracao na pagina

Arquivo: `src/routes/_authenticated/dashboards/$id/index.tsx`

- View mode: renderiza `<FilterBar>` com os filtros do dashboard
- Edit mode: mostra pills dos filtros existentes (clicaveis para editar) + botao "Adicionar filtro"

---

## Fluxo de Dados Completo

```
[Usuario seleciona valores no FilterBar]
    ↓
activeFilters state atualiza: { filterId: ["Nike", "Adidas"] }
    ↓
queryKey muda → TanStack Query refetch
    ↓
POST /v1/dashboards/:id/data { activeFilters }
    ↓
Backend DashboardsService.getData():
  Para cada dashboardComponent:
    - Busca filtros que targetam este component via targetMappings
    - Monta injectedFilters: [{ field: "brand", operator: "in", value: ["Nike", "Adidas"] }]
    - Chama ComponentsService.getData(componentId, userId, injectedFilters)
      - Chama QueriesService.execute(queryId, userId, injectedFilters)
        - QueryBuilderService.compileAny(config, injectedFilters)
          - Prepende $match stage com os filtros
    ↓
Resultado volta → Grid re-renderiza com dados filtrados
```

---

## Limitacoes Conhecidas

1. **Mapeamento manual:** O usuario precisa selecionar manualmente qual campo do componente corresponde ao filtro. Nao ha deteccao automatica de relacionamentos.
2. **Sem suporte a operadores complexos:** Filtros sempre usam operador `$in`. Nao ha suporte a ranges, regex, etc. no fluxo de filtros (so no QueryBuilder).
3. **Sem ordenacao de filtros:** Filtros aparecem na ordem de criacao. Nao ha drag-and-drop para reordenar.
4. **Performance:** Cada mudanca de filtro refaz todas as queries de todos os componentes. Nao ha refetch parcial.
5. **DATE_RANGE e TEXT:** Tipos definidos no enum mas sem UI especifica implementada ainda — so MULTI_SELECT e SELECT funcionam.

---

## Evolucoes Futuras

- Deteccao automatica de relacionamentos entre collections (via $lookup metadata)
- Filtros derivados de componentes de tabela (usar resultado de uma query como fonte de valores)
- UI de date picker para DATE_RANGE
- Reordenacao de filtros via drag-and-drop
- Refetch parcial (so componentes afetados pelo filtro que mudou)
- Operadores alem de `$in` (between, regex, exists)
