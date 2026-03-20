# AGENTS.md — duck-analytics-front

Guia de arquitetura e estilo de componentes para agentes de IA trabalhando neste repositório.

---

## Stack

- **Vite + React 19 + TypeScript**
- **TanStack Router** (file-based routing com geração automática)
- **TanStack Query** para server state
- **shadcn/ui** com preset **nova** (componentes em `src/components/ui/`)
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **recharts** para gráficos
- **react-grid-layout v2** para dashboards com drag/resize
- **Axios** para HTTP (`src/services/api.ts`)

---

## Roteamento

O TanStack Router gera `src/routeTree.gen.ts` automaticamente a partir dos arquivos em `src/routes/`. **Nunca editar esse arquivo.**

### Hierarquia de rotas

```
__root.tsx                     # Root: só adiciona <Toaster />
  index.tsx                    # Redirect para /dashboards
  sign-in.tsx                  # Pública
  sign-up.tsx                  # Pública
  _authenticated.tsx           # Layout autenticado: sidebar + header de 3rem
    _authenticated/
      dashboards/index.tsx     # /dashboards
      dashboards/new.tsx
      dashboards/$id/index.tsx
      dashboards/$id/edit.tsx
      questions/index.tsx      # /questions (lista)
      questions/new.tsx        # /questions/new (editor full-height)
      questions/$id.tsx        # /questions/:id (editor full-height)
      data-sources/...
      settings/index.tsx
```

O prefixo `_authenticated` é um layout route — não aparece na URL. O `beforeLoad` redireciona para `/sign-in` se não houver token.

### Como adicionar uma página nova

1. Criar o arquivo em `src/routes/_authenticated/recurso/index.tsx`
2. Exportar `export const Route = createFileRoute('/_authenticated/recurso/')({ component: Page })`
3. O router detecta automaticamente — não precisa registrar em nenhum outro lugar

### Parâmetros de rota

```typescript
// Na rota com $id:
const { id } = Route.useParams()

// Link para rota parametrizada:
<Link to="/recurso/$id" params={{ id: item.id }}>
```

---

## Layout autenticado

O `_authenticated.tsx` envolve o conteúdo com `<div className="p-6">`. Todas as páginas normais recebem esse padding automaticamente — **não adicionar `p-6` manualmente** nas páginas.

### Exceção: páginas full-height (como o Question Editor)

Quando uma página precisa ocupar toda a altura disponível (sem o padding), usar na rota:

```tsx
function NewQuestionPage() {
  return (
    <div className="-mx-6 -my-6 h-[calc(100vh-3rem)]">
      <QuestionEditor />
    </div>
  )
}
```

O `-mx-6 -my-6` cancela o `p-6` do layout. O `h-[calc(100vh-3rem)]` ocupa toda a altura menos o header de 3rem do layout autenticado.

---

## Estilo de componentes

### Utilitário `cn()`

Sempre usar `cn()` de `@/lib/utils` para combinar classes condicionais:

```tsx
import { cn } from '@/lib/utils'

<div className={cn('base-class', isActive && 'active-class', variant === 'ghost' && 'ghost-class')} />
```

### Componentes shadcn/ui

Todos os componentes de UI estão em `src/components/ui/` e são importados diretamente:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
```

Para adicionar novos componentes shadcn: `npx shadcn add <nome>`. Os arquivos gerados vão para `src/components/ui/` e podem ser editados livremente.

### Estrutura de uma página típica

```tsx
function RecursosPage() {
  // 1. Queries de dados
  const { data, isLoading } = useQuery<Recurso[]>({
    queryKey: ['recursos'],
    queryFn: () => api.get('/v1/recursos').then((r) => r.data),
  })

  // 2. Mutations com feedback via toast
  const qc = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/recursos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recursos'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  // 3. Loading state simples
  if (isLoading) return <div>Loading...</div>

  // 4. Layout: header com título + botão de ação, depois o conteúdo
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recursos</h1>
        <Button asChild>
          <Link to="/recursos/new">New</Link>
        </Button>
      </div>
      {/* conteúdo */}
    </div>
  )
}
```

### Estrutura de um formulário simples

```tsx
function NewRecursoPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/v1/recursos', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recursos'] })
      toast.success('Created')
      navigate({ to: '/recursos' })
    },
    onError: () => toast.error('Failed to create'),
  })

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader><CardTitle>New Recurso</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/recursos' })}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Padrões de spacing

- Listas de cards: `<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">`
- Campos de formulário empilhados: `<div className="space-y-2">` (label + input)
- Seções dentro de um form/card: `<div className="space-y-4">`
- Header de página com ação: `<div className="flex items-center justify-between">`

---

## Data fetching

### Padrão TanStack Query

```typescript
// Leitura
const { data, isLoading } = useQuery<TipoEsperado>({
  queryKey: ['chave', paramId],         // paramId no queryKey quando depende de ID
  queryFn: () => api.get('/v1/...').then((r) => r.data),
  enabled: !!paramId,                   // só executa se tiver o parâmetro
})

// Mutação
const mutation = useMutation({
  mutationFn: (payload) => api.post('/v1/...', payload),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['chave'] })  // invalidar cache relacionado
    toast.success('...')
  },
  onError: () => toast.error('...'),
})
```

O `QueryClient` tem `staleTime: 30_000` e `retry: 1` por padrão.

---

## Serviço de API

Importar sempre de `@/services/api`:

```typescript
import { api } from '@/services/api'
```

O Axios instance:
- Base URL: `VITE_API_URL` env var ou `http://localhost:3000`
- Interceptor de request: adiciona `Authorization: Bearer <token>` do `localStorage`
- Interceptor de response: em 401, limpa o token e redireciona para `/sign-in`

---

## Tipos

Todos os tipos compartilhados ficam em `src/types/index.ts`. Ao adicionar uma entidade nova do backend, adicionar a interface correspondente aqui. O arquivo exporta tipos simples sem lógica — apenas interfaces e type aliases que espelham os models do Prisma e as respostas da API.

---

## Componentes customizados principais

### `ChartRenderer` (`src/components/visualizations/ChartRenderer.tsx`)

Renderiza TABLE / BAR_CHART / LINE_CHART / PIE_CHART / KPI com recharts.

```tsx
<ChartRenderer
  type="BAR_CHART"
  data={rows}                     // Record<string, unknown>[]
  configuration={{ xField: 'date', yField: 'total' }}
/>
```

### `QuestionEditor` (`src/components/question-editor/QuestionEditor.tsx`)

Editor unificado de query + visualização no estilo Metabase. Ocupa altura total (deve ser montado com `-mx-6 -my-6 h-[calc(100vh-3rem)]`). Aceita `initialQuery` e `initialComponent` para edição.

### `DashboardGrid` (`src/components/dashboard/DashboardGrid.tsx`)

Grid com drag/resize usando react-grid-layout v2. A API mudou na v2: as props de configuração são passadas como objetos (`gridConfig`, `dragConfig`, `resizeConfig`), não como props flat no topo.

---

## Adicionando um item ao sidebar

Editar `src/components/layout/AppSidebar.tsx`, array `navItems`:

```typescript
const navItems = [
  { label: 'Dashboards', to: '/dashboards' },
  { label: 'Questions', to: '/questions' },
  { label: 'Data Sources', to: '/data-sources' },
]
```

O componente usa `<Link to={item.to}>` do TanStack Router — o active state é tratado automaticamente pelo shadcn `SidebarMenuButton`.
