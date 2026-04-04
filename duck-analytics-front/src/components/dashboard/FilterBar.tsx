import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Filter, X, ChevronDown, Search } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { DashboardFilter, FilterRelationship } from '@/types'

interface FilterBarProps {
  dashboardId: string
  filters: DashboardFilter[]
  activeFilters: Record<string, unknown[]>
  onFiltersChange: (filters: Record<string, unknown[]>) => void
  relationships?: FilterRelationship[]
}

export function FilterBar({
  dashboardId,
  filters,
  activeFilters,
  onFiltersChange,
  relationships = [],
}: FilterBarProps) {
  const qc = useQueryClient()

  // Sort filters: parents first, then children
  const sortedFilters = useMemo(() => {
    const roots = filters.filter((f) => !f.parentFilterId)
    const children = filters.filter((f) => f.parentFilterId)
    const sorted: DashboardFilter[] = []
    const visited = new Set<string>()

    function visit(f: DashboardFilter) {
      if (visited.has(f.id)) return
      visited.add(f.id)
      sorted.push(f)
      children.filter((c) => c.parentFilterId === f.id).forEach(visit)
    }

    roots.forEach(visit)
    // Add any remaining filters not reachable from roots
    children.forEach((c) => { if (!visited.has(c.id)) sorted.push(c) })
    return sorted
  }, [filters])

  function getDescendantIds(filterId: string): string[] {
    const children = filters.filter((f) => f.parentFilterId === filterId)
    const ids: string[] = []
    for (const child of children) {
      ids.push(child.id)
      ids.push(...getDescendantIds(child.id))
    }
    return ids
  }

  function handleFilterChange(filterId: string, values: unknown[]) {
    const next = { ...activeFilters, [filterId]: values }
    // Clear all descendant filters when parent changes
    const descendantIds = getDescendantIds(filterId)
    for (const id of descendantIds) {
      delete next[id]
    }
    // Clear relationship target filters when source changes
    for (const rel of relationships) {
      if (rel.sourceFilterId === filterId) {
        delete next[rel.targetFilterId]
      }
    }
    onFiltersChange(next)

    // Eagerly fetch related target filter values as soon as source changes.
    // This guarantees a backend call at selection time (not only on dropdown open).
    const affectedTargets = [...new Set(
      relationships
        .filter((r) => r.sourceFilterId === filterId)
        .map((r) => r.targetFilterId),
    )]

    for (const targetFilterId of affectedTargets) {
      const targetRelationships = relationships.filter(
        (r) => r.targetFilterId === targetFilterId,
      )
      const relConstraintKey = targetRelationships
        .map((r) => `${r.id}:${serializeFilterValues(next[r.sourceFilterId])}`)
        .join('|')

      void qc.prefetchQuery({
        queryKey: [
          'filter-values',
          dashboardId,
          targetFilterId,
          '',
          undefined,
          relConstraintKey,
        ],
        queryFn: () =>
          api
            .post(`/v1/dashboards/${dashboardId}/filters/${targetFilterId}/values`, {
              page: 1,
              pageSize: 100,
              activeFilters: next,
              relationships: targetRelationships,
            })
            .then((r) => r.data),
        staleTime: 0,
      })
    }
  }

  function handleClearAll() {
    onFiltersChange({})
  }

  const hasActiveFilters = Object.values(activeFilters).some((v) => v.length > 0)

  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      {sortedFilters.map((filter) => {
        const parentSelected = filter.parentFilterId
          ? (activeFilters[filter.parentFilterId] ?? []).length > 0
          : true
        return (
          <FilterDropdown
            key={filter.id}
            dashboardId={dashboardId}
            filter={filter}
            selectedValues={activeFilters[filter.id] ?? []}
            parentValues={
              filter.parentFilterId
                ? activeFilters[filter.parentFilterId] ?? []
                : undefined
            }
            disabled={!!filter.parentFilterId && !parentSelected}
            onChange={(values) => handleFilterChange(filter.id, values)}
            activeFilters={activeFilters}
            relationships={relationships}
          />
        )
      })}
      {hasActiveFilters && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={handleClearAll}
        >
          <X className="h-3 w-3" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}

interface FilterDropdownProps {
  dashboardId: string
  filter: DashboardFilter
  selectedValues: unknown[]
  parentValues?: unknown[]
  disabled: boolean
  onChange: (values: unknown[]) => void
  activeFilters: Record<string, unknown[]>
  relationships: FilterRelationship[]
}

function serializeFilterValues(values: unknown[] | undefined) {
  if (!values || values.length === 0) return ''
  return values
    .map((v) => {
      if (v === null || v === undefined) return ''
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    })
    .join('|')
}

function FilterDropdown({
  dashboardId,
  filter,
  selectedValues,
  parentValues,
  disabled,
  onChange,
  activeFilters,
  relationships,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const parentValueParam = parentValues?.length
    ? parentValues.join(',')
    : undefined

  const targetRelationships = relationships.filter((r) => r.targetFilterId === filter.id)

  // Build a stable key for relationship constraints to trigger refetch
  const relConstraintKey = targetRelationships
    .map((r) => `${r.id}:${serializeFilterValues(activeFilters[r.sourceFilterId])}`)
    .join('|')

  const { data: valuesData, isLoading } = useQuery<{
    items: { label: string; value: unknown }[]
    page: number
    pageSize: number
    total?: number
  }>({
    queryKey: [
      'filter-values',
      dashboardId,
      filter.id,
      search,
      parentValueParam,
      relConstraintKey,
    ],
    queryFn: () => {
      // Use POST whenever there are relationships configured so backend can
      // always evaluate current active filters consistently.
      if (relationships.length > 0) {
        return api
          .post(
            `/v1/dashboards/${dashboardId}/filters/${filter.id}/values`,
            {
              page: 1,
              pageSize: 100,
              search: search || undefined,
              parentValue: parentValueParam,
              activeFilters,
              relationships: targetRelationships,
            },
          )
          .then((r) => r.data)
      }
      const params = new URLSearchParams({ page: '1', pageSize: '100' })
      if (search) params.set('search', search)
      if (parentValueParam) params.set('parentValue', parentValueParam)
      return api
        .get(
          `/v1/dashboards/${dashboardId}/filters/${filter.id}/values?${params}`,
        )
        .then((r) => r.data)
    },
    enabled: open && !disabled,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const items = valuesData?.items ?? []
  const selectedCount = selectedValues.length
  const hasActiveRelationshipSource = relationships.some(
    (r) =>
      r.targetFilterId === filter.id &&
      (activeFilters[r.sourceFilterId] ?? []).length > 0,
  )
  const constrainedCount = hasActiveRelationshipSource ? (valuesData?.total ?? items.length) : 0
  const badgeCount = selectedCount > 0 ? selectedCount : constrainedCount

  function toggleValue(val: unknown) {
    const strVal = String(val)
    const has = selectedValues.some((v) => String(v) === strVal)
    if (has) {
      onChange(selectedValues.filter((v) => String(v) !== strVal))
    } else {
      onChange([...selectedValues, val])
    }
  }

  function selectAll() {
    onChange(items.map((i) => i.value))
  }

  function clearSelection() {
    onChange([])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'h-7 gap-1 text-xs',
            badgeCount > 0 && 'border-primary text-primary',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={disabled}
        >
          {filter.label}
          {badgeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px]"
            >
              {badgeCount}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto p-1">
          {isLoading ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              {hasActiveRelationshipSource
                ? 'Nenhum valor encontrado com os relacionamentos ativos. Revise os campos vinculados.'
                : 'Nenhum valor encontrado'}
            </div>
          ) : (
            items.map((item) => {
              const strVal = String(item.value)
              const checked = selectedValues.some(
                (v) => String(v) === strVal,
              )
              return (
                <label
                  key={strVal}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleValue(item.value)}
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              )
            })
          )}
        </div>
        {items.length > 0 && (
          <div className="flex justify-between border-t px-2 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={selectAll}
            >
              Selecionar todos
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={clearSelection}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
