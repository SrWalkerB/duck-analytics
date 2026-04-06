import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Filter, X, ChevronDown, Search } from 'lucide-react'
import { embedApi } from '@/services/embed-api'
import type { Dashboard, DashboardFilter, DashboardTab, EmbedType } from '@/types'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface EmbedResponse {
  dashboard: Dashboard
  showFilters: boolean
  showTitle: boolean
  embedType: EmbedType
}

export const Route = createFileRoute('/embed/$code')({
  component: EmbedPage,
})

function EmbedPage() {
  const { code } = Route.useParams()
  const searchParams = new URLSearchParams(window.location.search)
  const token = searchParams.get('token') || undefined
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''

  const [activeFilters, setActiveFilters] = useState<Record<string, unknown[]>>({})

  const { data: embedData, isLoading, error } = useQuery<EmbedResponse>({
    queryKey: ['embed', code, token],
    queryFn: () =>
      embedApi.get(`/v1/embed/${code}${tokenParam}`).then((r) => r.data),
  })

  const { data: dashboardData } = useQuery<
    Record<string, { data: Record<string, unknown>[]; count: number }>
  >({
    queryKey: ['embed-data', code, token, activeFilters],
    queryFn: () =>
      embedApi
        .post(`/v1/embed/${code}/data${tokenParam}`, { activeFilters })
        .then((r) => r.data),
    enabled: !!embedData,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (error || !embedData) {
    const status = (error as { response?: { status?: number } })?.response?.status
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">
            {status === 401 ? 'Acesso não autorizado' : 'Dashboard não encontrado'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {status === 401
              ? 'O token de acesso é inválido ou expirou.'
              : 'O link de embed pode estar incorreto ou o dashboard foi despublicado.'}
          </p>
        </div>
      </div>
    )
  }

  const { dashboard, showFilters, showTitle } = embedData
  const tabs = (dashboard.configuration?.tabs as DashboardTab[] | undefined) ?? []
  const effectiveTabs =
    tabs.length > 0 ? tabs : [{ id: 'default', name: 'Guia 1', order: 0 }]

  return (
    <div className="min-h-screen bg-background p-4">
      {showTitle && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-muted-foreground mt-1">{dashboard.description}</p>
          )}
        </div>
      )}

      {showFilters && dashboard.dashboardFilters.length > 0 && (
        <div className="mb-4">
          <EmbedFilterBar
            embedCode={code}
            token={token}
            filters={dashboard.dashboardFilters}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
          />
        </div>
      )}

      <DashboardGrid
        dashboard={dashboard}
        data={dashboardData ?? {}}
        isEditMode={false}
        activeTabId={null}
        tabs={effectiveTabs}
      />
    </div>
  )
}

// ── Embed Filter Bar (uses public embed endpoints) ──

interface EmbedFilterBarProps {
  embedCode: string
  token?: string
  filters: DashboardFilter[]
  activeFilters: Record<string, unknown[]>
  onFiltersChange: (filters: Record<string, unknown[]>) => void
}

function EmbedFilterBar({
  embedCode,
  token,
  filters,
  activeFilters,
  onFiltersChange,
}: EmbedFilterBarProps) {
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''

  const sortedFilters = useMemo(() => {
    const roots = filters.filter((f) => !f.parentFilterId)
    const children = filters.filter((f) => f.parentFilterId)
    const sorted: DashboardFilter[] = []
    const visited = new Set<string>()

    function visit(f: DashboardFilter) {
      if (visited.has(f.id)) return
      visited.add(f.id)
      sorted.push(f)
      children
        .filter((c) => c.parentFilterId === f.id)
        .forEach(visit)
    }
    roots.forEach(visit)
    children.filter((c) => !visited.has(c.id)).forEach((c) => sorted.push(c))
    return sorted
  }, [filters])

  const hasActiveFilters = Object.values(activeFilters).some((v) => v.length > 0)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      {sortedFilters.map((filter) => {
        const parentOk =
          !filter.parentFilterId ||
          (activeFilters[filter.parentFilterId]?.length ?? 0) > 0
        return (
          <EmbedFilterDropdown
            key={filter.id}
            embedCode={embedCode}
            token={token}
            tokenParam={tokenParam}
            filter={filter}
            activeFilters={activeFilters}
            onFiltersChange={onFiltersChange}
            disabled={!parentOk}
          />
        )
      })}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          <X className="mr-1 h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  )
}

interface EmbedFilterDropdownProps {
  embedCode: string
  token?: string
  tokenParam: string
  filter: DashboardFilter
  activeFilters: Record<string, unknown[]>
  onFiltersChange: (filters: Record<string, unknown[]>) => void
  disabled: boolean
}

function EmbedFilterDropdown({
  embedCode,
  tokenParam,
  filter,
  activeFilters,
  onFiltersChange,
  disabled,
}: EmbedFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = activeFilters[filter.id] ?? []

  const parentValue = filter.parentFilterId
    ? activeFilters[filter.parentFilterId]?.join(',')
    : undefined

  const params = new URLSearchParams({ page: '1', pageSize: '100' })
  if (search) params.set('search', search)
  if (parentValue) params.set('parentValue', parentValue)

  const { data: valuesData } = useQuery<{
    items: { label: string; value: unknown }[]
    total: number
  }>({
    queryKey: ['embed-filter-values', embedCode, filter.id, search, parentValue],
    queryFn: () =>
      embedApi
        .get(
          `/v1/embed/${embedCode}/filters/${filter.id}/values${tokenParam}${tokenParam ? '&' : '?'}${params}`,
        )
        .then((r) => r.data),
    enabled: open && !disabled,
  })

  const items = valuesData?.items ?? []

  function toggleValue(value: unknown) {
    const key = String(value)
    const current = selected.map(String)
    const next = current.includes(key)
      ? selected.filter((v) => String(v) !== key)
      : [...selected, value]
    onFiltersChange({ ...activeFilters, [filter.id]: next })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(selected.length > 0 && 'border-primary')}
        >
          {filter.label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const checked = selected.map(String).includes(String(item.value))
            return (
              <label
                key={String(item.value)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleValue(item.value)}
                />
                {item.label}
              </label>
            )
          })}
          {items.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Nenhum valor encontrado
            </p>
          )}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full"
            onClick={() =>
              onFiltersChange({ ...activeFilters, [filter.id]: [] })
            }
          >
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
