import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  Database,
  Filter,
  Sigma,
  SlidersHorizontal,
  Table2,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Sparkles,
  Link2,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  MoveUp,
  MoveDown,
} from 'lucide-react'
import { api } from '@/services/api'
import type {
  DataSource,
  FieldSchema,
  QueryConfiguration,
  QueryFilter,
  QueryAggregation,
  QueryLookup,
  QuerySort,
  ComponentType,
  Component,
  Query,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartRenderer } from '@/components/visualizations/ChartRenderer'
import { ResultsTable } from '@/components/question-editor/ResultsTable'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Mode = 'editor' | 'visualization'

const VIZ_TYPES: { type: ComponentType; label: string; icon: React.ReactNode }[] = [
  { type: 'TABLE', label: 'Table', icon: <Table2 size={18} /> },
  { type: 'BAR_CHART', label: 'Bar', icon: <BarChart2 size={18} /> },
  { type: 'LINE_CHART', label: 'Line', icon: <LineChart size={18} /> },
  { type: 'PIE_CHART', label: 'Pie', icon: <PieChart size={18} /> },
  { type: 'KPI', label: 'KPI', icon: <Hash size={18} /> },
]

const AGGREGATION_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const

// Operators by field type
function operatorsForType(type: string) {
  switch (type) {
    case 'boolean':
      return ['eq', 'ne', 'exists'] as const
    case 'date':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'exists'] as const
    case 'number':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists'] as const
    case 'objectId':
      return ['eq', 'ne', 'in', 'nin', 'exists'] as const
    case 'array':
      return ['in', 'nin', 'exists'] as const
    default:
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex', 'exists'] as const
  }
}

// Type badge colors
const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-500/10 text-blue-500',
  number: 'bg-amber-500/10 text-amber-500',
  boolean: 'bg-emerald-500/10 text-emerald-500',
  date: 'bg-violet-500/10 text-violet-500',
  objectId: 'bg-orange-500/10 text-orange-500',
  array: 'bg-cyan-500/10 text-cyan-500',
  object: 'bg-pink-500/10 text-pink-500',
  null: 'bg-muted text-muted-foreground',
  mixed: 'bg-muted text-muted-foreground',
}

interface Props {
  initialQuery?: Query
  initialComponent?: Component
}

export function QuestionEditor({ initialQuery, initialComponent }: Props) {
  const navigate = useNavigate()

  const [name, setName] = useState(
    initialComponent?.name ?? initialQuery?.name ?? 'Sem título',
  )
  const [editingName, setEditingName] = useState(false)
  const [mode, setMode] = useState<Mode>('editor')

  // Query state — always editable (even when editing existing)
  const [dataSourceId, setDataSourceId] = useState(initialQuery?.dataSourceId ?? '')
  const [collection, setCollection] = useState(initialQuery?.collection ?? '')
  const [collectionSearch, setCollectionSearch] = useState('')
  const [config, setConfig] = useState<QueryConfiguration>(
    (initialQuery?.configuration as QueryConfiguration) ?? {},
  )

  // Viz state
  const [vizType, setVizType] = useState<ComponentType>(initialComponent?.type ?? 'TABLE')
  const [xField, setXField] = useState((initialComponent?.configuration['xField'] as string) ?? '')
  const [yField, setYField] = useState((initialComponent?.configuration['yField'] as string) ?? '')
  const [vizLabel, setVizLabel] = useState(
    (initialComponent?.configuration['label'] as string) ?? '',
  )

  // Section collapse state
  const [showFilters, setShowFilters] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)
  const [showJoins, setShowJoins] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // Results
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Dirty state — track if config changed since last run
  const lastRunConfig = useRef<string | null>(null)
  const isDirty = useMemo(() => {
    if (!results) return false
    return lastRunConfig.current !== JSON.stringify({ dataSourceId, collection, config })
  }, [results, dataSourceId, collection, config])

  // Visible columns for TABLE mode
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null)

  // AI panel
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => api.get('/v1/data-sources').then((r) => r.data),
  })

  const { data: collectionsData } = useQuery<{ collections: string[] }>({
    queryKey: ['ds-collections', dataSourceId],
    queryFn: () => api.get(`/v1/data-sources/${dataSourceId}/collections`).then((r) => r.data),
    enabled: !!dataSourceId,
  })

  const { data: schema } = useQuery<{ collection: string; fields: FieldSchema[] }>({
    queryKey: ['collection-schema', dataSourceId, collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${dataSourceId}/collections/${collection}/schema`)
        .then((r) => r.data),
    enabled: !!dataSourceId && !!collection,
  })

  // Fetch schemas for lookup collections (for field discovery)
  const lookupSchemaQueries = useQueries({
    queries: (config.lookups ?? []).map((lk) => ({
      queryKey: ['collection-schema', dataSourceId, lk.from],
      queryFn: () =>
        api
          .get(`/v1/data-sources/${dataSourceId}/collections/${lk.from}/schema`)
          .then((r) => r.data as { collection: string; fields: FieldSchema[] }),
      enabled: !!dataSourceId && !!lk.from,
    })),
  })

  const fields = schema?.fields ?? []

  // All available fields including joined fields
  const allFields = useMemo<FieldSchema[]>(() => {
    const base: FieldSchema[] = [...fields]
    ;(config.lookups ?? []).forEach((lk, i) => {
      const lkSchema = lookupSchemaQueries[i]?.data
      if (!lkSchema) return
      if (lk.unwind) {
        // Prefix each foreign field with the alias
        lkSchema.fields.forEach((f) => {
          base.push({ name: `${lk.as}.${f.name}`, type: f.type })
        })
      } else {
        // Lookup without unwind → single array field
        base.push({ name: lk.as, type: 'array' })
      }
    })
    return base
  }, [fields, config.lookups, lookupSchemaQueries])

  const allFieldMap = useMemo(
    () => Object.fromEntries(allFields.map((f) => [f.name, f.type])),
    [allFields],
  )

  const resultFields = useMemo(() => {
    if (results && results.length > 0) return Object.keys(results[0]!)
    return allFields.map((f) => f.name)
  }, [results, allFields])

  const sortedCollections = useMemo(() => {
    const list = collectionsData?.collections ?? []
    return [...list].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [collectionsData])

  const visibleCollections = useMemo(() => {
    const term = collectionSearch.trim().toLowerCase()
    if (!term) return sortedCollections
    return sortedCollections.filter((c) => c.toLowerCase().includes(term))
  }, [collectionSearch, sortedCollections])

  useEffect(() => {
    setCollectionSearch('')
  }, [dataSourceId])

  // Auto-run when editing existing component
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (autoRanRef.current) return
    if (initialQuery && dataSourceId && collection && !results) {
      autoRanRef.current = true
      handleRun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When data source changes during edit, clear collection and config
  function handleDataSourceChange(v: string) {
    setDataSourceId(v)
    setCollection('')
    setConfig({})
    setResults(null)
  }

  function handleCollectionChange(v: string) {
    setCollection(v)
    setConfig({})
    setResults(null)
  }

  async function handleRun() {
    if (!dataSourceId || !collection) return
    setIsRunning(true)
    try {
      const res = await api.post('/v1/queries/preview', {
        dataSourceId,
        collection,
        configuration: config,
      })
      const data = res.data.data as Record<string, unknown>[]
      setResults(data)
      lastRunConfig.current = JSON.stringify({ dataSourceId, collection, config })
      if (data.length > 0) {
        const cols = Object.keys(data[0]!)
        if (!xField && cols[0]) setXField(cols[0])
        if (!yField && cols[1]) setYField(cols[1])
      }
      toast.success(`${res.data.count} linha${res.data.count !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Falha ao executar query')
    } finally {
      setIsRunning(false)
    }
  }

  async function handleSave() {
    if (!dataSourceId || !collection) {
      toast.error('Selecione um data source e uma collection')
      return
    }
    setIsSaving(true)
    try {
      const vizConf = { xField, yField, label: vizLabel }
      let queryId = initialQuery?.id

      if (initialQuery) {
        await api.put(`/v1/queries/${initialQuery.id}`, {
          name,
          dataSourceId,
          collection,
          configuration: config,
        })
      } else {
        const qRes = await api.post('/v1/queries', {
          name,
          dataSourceId,
          collection,
          configuration: config,
        })
        queryId = qRes.data.id
      }

      if (initialComponent) {
        await api.put(`/v1/components/${initialComponent.id}`, {
          name,
          type: vizType,
          configuration: vizConf,
        })
      } else {
        await api.post('/v1/components', {
          name,
          type: vizType,
          queryId,
          configuration: vizConf,
        })
      }

      toast.success('Salvo!')
      navigate({ to: '/questions' })
    } catch {
      toast.error('Falha ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  // AI generation
  async function handleAiGenerate() {
    if (!aiPrompt.trim() || !dataSourceId || !collection) {
      toast.error('Selecione uma collection e descreva o que deseja')
      return
    }
    setIsGenerating(true)
    try {
      const res = await api.post('/v1/ai/generate-component', {
        dataSourceId,
        collection,
        prompt: aiPrompt,
      })
      const g = res.data as {
        name: string
        vizType: ComponentType
        configuration: QueryConfiguration
        xField?: string
        yField?: string
        vizLabel?: string
      }
      setConfig(g.configuration ?? {})
      setVizType(g.vizType ?? 'TABLE')
      if (g.xField) setXField(g.xField)
      if (g.yField) setYField(g.yField)
      if (g.vizLabel) setVizLabel(g.vizLabel)
      if (g.name && name === 'Sem título') setName(g.name)
      setAiOpen(false)
      toast.success('Configuração gerada! Clique em Run para ver o resultado.')
    } catch {
      toast.error('Falha ao gerar — verifique sua API key em Settings')
    } finally {
      setIsGenerating(false)
    }
  }

  // Filters
  function addFilter() {
    const firstField = allFields[0]
    setConfig((c) => ({
      ...c,
      filters: [
        ...(c.filters ?? []),
        {
          field: firstField?.name ?? '',
          operator: 'eq' as const,
          value: firstField?.type === 'boolean' ? true : '',
        },
      ],
    }))
  }
  function updateFilter(i: number, patch: Partial<QueryFilter>) {
    setConfig((c) => {
      const filters = [...(c.filters ?? [])]
      // When field changes, reset value to sensible default for type
      if (patch.field && patch.field !== filters[i]?.field) {
        const newType = allFieldMap[patch.field] ?? 'string'
        patch.value = newType === 'boolean' ? true : newType === 'number' ? 0 : ''
        const ops = operatorsForType(newType)
        if (!ops.includes(filters[i]?.operator as never)) {
          patch.operator = ops[0] as QueryFilter['operator']
        }
      }
      filters[i] = { ...filters[i]!, ...patch }
      return { ...c, filters }
    })
  }
  function removeFilter(i: number) {
    setConfig((c) => ({ ...c, filters: c.filters?.filter((_, j) => j !== i) }))
  }

  // Aggregations
  function addAgg() {
    setConfig((c) => ({
      ...c,
      aggregations: [
        ...(c.aggregations ?? []),
        { field: allFields[0]?.name ?? '', function: 'COUNT' as const, alias: 'count' },
      ],
    }))
  }
  function updateAgg(i: number, patch: Partial<QueryAggregation>) {
    setConfig((c) => {
      const aggs = [...(c.aggregations ?? [])]
      aggs[i] = { ...aggs[i]!, ...patch }
      return { ...c, aggregations: aggs }
    })
  }
  function removeAgg(i: number) {
    setConfig((c) => ({ ...c, aggregations: c.aggregations?.filter((_, j) => j !== i) }))
  }

  // Lookups
  function addLookup() {
    const otherCollection = sortedCollections.find((c) => c !== collection) ?? ''
    setConfig((c) => ({
      ...c,
      lookups: [
        ...(c.lookups ?? []),
        { from: otherCollection, localField: '', foreignField: '_id', as: otherCollection },
      ],
    }))
  }
  function updateLookup(i: number, patch: Partial<QueryLookup>) {
    setConfig((c) => {
      const lookups = [...(c.lookups ?? [])]
      lookups[i] = { ...lookups[i]!, ...patch }
      return { ...c, lookups }
    })
  }
  function removeLookup(i: number) {
    setConfig((c) => ({ ...c, lookups: c.lookups?.filter((_, j) => j !== i) }))
  }

  // Sort
  function addSort() {
    setConfig((c) => ({
      ...c,
      sort: [...(c.sort ?? []), { field: allFields[0]?.name ?? '', direction: 'asc' as const }],
    }))
  }
  function updateSort(i: number, patch: Partial<QuerySort>) {
    setConfig((c) => {
      const sort = [...(c.sort ?? [])]
      sort[i] = { ...sort[i]!, ...patch }
      return { ...c, sort }
    })
  }
  function removeSort(i: number) {
    setConfig((c) => ({ ...c, sort: c.sort?.filter((_, j) => j !== i) }))
  }
  function handleSortToggle(field: string) {
    setConfig((c) => {
      const sorts = [...(c.sort ?? [])]
      const idx = sorts.findIndex((s) => s.field === field)
      if (idx === -1) {
        return { ...c, sort: [...sorts, { field, direction: 'asc' as const }] }
      }
      if (sorts[idx]!.direction === 'asc') {
        sorts[idx] = { field, direction: 'desc' as const }
        return { ...c, sort: sorts }
      }
      // Was desc → remove
      return { ...c, sort: sorts.filter((_, j) => j !== idx) }
    })
    setShowSort(true)
  }

  // Filter value input based on field type
  function FilterValueInput({ filter, index }: { filter: QueryFilter; index: number }) {
    const fieldType = allFieldMap[filter.field] ?? 'string'

    if (filter.operator === 'exists') {
      return (
        <div className="flex items-center gap-2 px-1 py-0.5">
          <Checkbox
            id={`exists-${index}`}
            checked={filter.value === true || filter.value === 'true'}
            onCheckedChange={(v) => updateFilter(index, { value: v === true })}
          />
          <label htmlFor={`exists-${index}`} className="text-xs text-muted-foreground cursor-pointer">
            field must exist
          </label>
        </div>
      )
    }

    if (fieldType === 'boolean') {
      return (
        <div className="flex gap-1">
          {(['true', 'false'] as const).map((v) => (
            <button
              key={v}
              onClick={() => updateFilter(index, { value: v === 'true' })}
              className={cn(
                'flex-1 rounded border px-2 py-0.5 text-xs transition-colors',
                String(filter.value) === v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )
    }

    if (fieldType === 'date') {
      return (
        <Input
          type="datetime-local"
          className="h-6 text-xs"
          value={String(filter.value ?? '')}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
        />
      )
    }

    if (fieldType === 'number') {
      return (
        <Input
          type="number"
          className="h-6 text-xs"
          value={String(filter.value ?? '')}
          onChange={(e) => updateFilter(index, { value: parseFloat(e.target.value) || 0 })}
          placeholder="0"
        />
      )
    }

    // string, objectId, array, mixed — text input
    return (
      <Input
        className="h-6 text-xs"
        value={String(filter.value ?? '')}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        placeholder={fieldType === 'objectId' ? 'ObjectId...' : 'valor'}
      />
    )
  }

  // Collapsible section header
  function SectionHeader({
    icon,
    label,
    count,
    open,
    onToggle,
    onAdd,
  }: {
    icon: React.ReactNode
    label: string
    count?: number
    open: boolean
    onToggle: () => void
    onAdd: () => void
  }) {
    return (
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onToggle}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {icon}
          {label}
          {count ? (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 py-px text-[10px] text-primary-foreground">
              {count}
            </span>
          ) : null}
        </button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onAdd}>
          + Add
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Top bar ── */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => navigate({ to: '/questions' })}
        >
          <ArrowLeft size={15} />
        </Button>
        <Separator orientation="vertical" className="h-5" />

        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
            className="h-7 w-56 text-sm font-medium"
          />
        ) : (
          <button
            className="max-w-xs truncate text-sm font-medium hover:text-muted-foreground transition-colors"
            onClick={() => setEditingName(true)}
            title="Clique para renomear"
          >
            {name}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* AI button */}
          <Button
            size="sm"
            variant={aiOpen ? 'default' : 'outline'}
            className={cn(
              'h-8 gap-1.5 text-xs',
              !aiOpen && 'border-dashed',
            )}
            onClick={() => setAiOpen((v) => !v)}
            disabled={!dataSourceId || !collection}
            title={!dataSourceId || !collection ? 'Selecione um data source e collection primeiro' : 'Gerar com IA'}
          >
            <Sparkles size={12} />
            IA
          </Button>

          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-md border">
            <Button
              variant={mode === 'editor' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none px-3 text-xs"
              onClick={() => setMode('editor')}
            >
              Editor
            </Button>
            <Button
              variant={mode === 'visualization' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none border-l px-3 text-xs"
              onClick={() => setMode('visualization')}
            >
              Visualização
            </Button>
          </div>

          <Button
            size="sm"
            variant={isDirty ? 'default' : 'outline'}
            className={cn('h-8 gap-1.5', isDirty && 'animate-pulse')}
            onClick={handleRun}
            disabled={!dataSourceId || !collection || isRunning}
          >
            {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            {isRunning ? 'Rodando…' : 'Run'}
          </Button>

          <Button size="sm" className="h-8" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <div className="w-72 shrink-0 overflow-y-auto border-r">
          {mode === 'editor' ? (
            <div className="space-y-4 p-4">
              {/* Data Source */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Database size={11} />
                  Data Source
                </Label>
                <Select value={dataSourceId} onValueChange={handleDataSourceChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources?.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        {ds.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Collection */}
              {dataSourceId && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Collection</Label>
                  <Input
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Buscar coleções…"
                    className="h-7 text-xs"
                  />
                  <Select value={collection} onValueChange={handleCollectionChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCollections.length ? (
                        visibleCollections.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))
                      ) : (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                          Nenhuma coleção encontrada
                        </p>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {collection && (
                <>
                  <Separator />

                  {/* ── Filters ── */}
                  <div className="space-y-2">
                    <SectionHeader
                      icon={<Filter size={11} />}
                      label="Filtros"
                      count={config.filters?.length || undefined}
                      open={showFilters}
                      onToggle={() => setShowFilters((v) => !v)}
                      onAdd={addFilter}
                    />
                    {showFilters && (
                      <>
                        {(config.filters ?? []).map((f, i) => {
                          const fType = allFieldMap[f.field] ?? 'string'
                          const ops = operatorsForType(fType)
                          return (
                            <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                              {/* Field selector + type badge + remove */}
                              <div className="flex items-center gap-1">
                                <Select
                                  value={f.field}
                                  onValueChange={(v) => updateFilter(i, { field: v })}
                                >
                                  <SelectTrigger className="h-6 flex-1 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allFields.map((fd) => (
                                      <SelectItem key={fd.name} value={fd.name}>
                                        <span className="flex items-center gap-1.5">
                                          {fd.name.includes('.') && (
                                            <Link2 size={9} className="text-muted-foreground" />
                                          )}
                                          {fd.name}
                                          <span
                                            className={cn(
                                              'rounded px-1 text-[10px]',
                                              TYPE_COLORS[fd.type] ?? 'bg-muted text-muted-foreground',
                                            )}
                                          >
                                            {fd.type}
                                          </span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {f.field && (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded px-1 text-[10px]',
                                      TYPE_COLORS[fType] ?? 'bg-muted text-muted-foreground',
                                    )}
                                    title={fType}
                                  >
                                    {fType}
                                  </span>
                                )}
                                <button
                                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => removeFilter(i)}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                              {/* Operator */}
                              <Select
                                value={f.operator}
                                onValueChange={(v) =>
                                  updateFilter(i, { operator: v as QueryFilter['operator'] })
                                }
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ops.map((op) => (
                                    <SelectItem key={op} value={op}>
                                      {op}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Type-aware value input */}
                              <FilterValueInput filter={f} index={i} />
                            </div>
                          )
                        })}
                        {!config.filters?.length && (
                          <p className="text-xs text-muted-foreground">
                            Sem filtros — todos os documentos
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* ── Joins (Lookup) ── */}
                  <div className="space-y-2">
                    <SectionHeader
                      icon={<Link2 size={11} />}
                      label="Joins"
                      count={config.lookups?.length || undefined}
                      open={showJoins}
                      onToggle={() => setShowJoins((v) => !v)}
                      onAdd={addLookup}
                    />
                    {showJoins && (
                      <>
                        {(config.lookups ?? []).map((lk, i) => (
                          <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">Join {i + 1}</span>
                              <button
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => removeLookup(i)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">From collection</Label>
                              <Select
                                value={lk.from}
                                onValueChange={(v) => updateLookup(i, { from: v })}
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Collection…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sortedCollections
                                    .filter((c) => c !== collection)
                                    .map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <div className="space-y-0.5">
                                <Label className="text-[10px] text-muted-foreground">Local field</Label>
                                <Select
                                  value={lk.localField}
                                  onValueChange={(v) => updateLookup(i, { localField: v })}
                                >
                                  <SelectTrigger className="h-6 text-xs">
                                    <SelectValue placeholder="campo…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fields.map((f) => (
                                      <SelectItem key={f.name} value={f.name}>
                                        {f.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[10px] text-muted-foreground">Foreign field</Label>
                                <Select
                                  value={lk.foreignField}
                                  onValueChange={(v) => updateLookup(i, { foreignField: v })}
                                >
                                  <SelectTrigger className="h-6 text-xs">
                                    <SelectValue placeholder="_id" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(lookupSchemaQueries[i]?.data?.fields ?? []).map((f) => (
                                      <SelectItem key={f.name} value={f.name}>
                                        {f.name}
                                      </SelectItem>
                                    ))}
                                    {!lookupSchemaQueries[i]?.data && (
                                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                        {lk.from ? 'Carregando…' : 'Selecione a collection'}
                                      </p>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">Output alias</Label>
                              <Input
                                className="h-6 text-xs"
                                value={lk.as}
                                onChange={(e) => updateLookup(i, { as: e.target.value })}
                                placeholder="joined_data"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-0.5">
                              <Checkbox
                                id={`unwind-${i}`}
                                checked={lk.unwind ?? false}
                                onCheckedChange={(v) => updateLookup(i, { unwind: v === true })}
                              />
                              <label htmlFor={`unwind-${i}`} className="cursor-pointer text-xs text-muted-foreground">
                                Flatten array (unwind)
                              </label>
                            </div>
                          </div>
                        ))}
                        {!config.lookups?.length && (
                          <p className="text-xs text-muted-foreground">Sem joins</p>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* ── Metrics ── */}
                  <div className="space-y-2">
                    <SectionHeader
                      icon={<Sigma size={11} />}
                      label="Métricas"
                      count={config.aggregations?.length || undefined}
                      open={showMetrics}
                      onToggle={() => setShowMetrics((v) => !v)}
                      onAdd={addAgg}
                    />
                    {showMetrics && (
                      <>
                        {(config.aggregations ?? []).map((agg, i) => (
                          <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                            <div className="flex items-center gap-1">
                              <Select
                                value={agg.function}
                                onValueChange={(v) =>
                                  updateAgg(i, { function: v as QueryAggregation['function'] })
                                }
                              >
                                <SelectTrigger className="h-6 w-28 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AGGREGATION_FUNCTIONS.map((fn) => (
                                    <SelectItem key={fn} value={fn}>
                                      {fn}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => removeAgg(i)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <Select
                              value={agg.field}
                              onValueChange={(v) => updateAgg(i, { field: v })}
                            >
                              <SelectTrigger className="h-6 text-xs">
                                <SelectValue placeholder="campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {allFields.map((fd) => (
                                  <SelectItem key={fd.name} value={fd.name}>
                                    <span className="flex items-center gap-1.5">
                                      {fd.name.includes('.') && (
                                        <Link2 size={9} className="text-muted-foreground" />
                                      )}
                                      {fd.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-6 text-xs"
                              placeholder="alias (ex: total)"
                              value={agg.alias}
                              onChange={(e) => updateAgg(i, { alias: e.target.value })}
                            />
                          </div>
                        ))}
                        {!config.aggregations?.length && (
                          <p className="text-xs text-muted-foreground">
                            Sem métricas — documentos brutos
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* ── Sort ── */}
                  <div className="space-y-2">
                    <SectionHeader
                      icon={<ArrowUpDown size={11} />}
                      label="Ordenar"
                      count={config.sort?.length || undefined}
                      open={showSort}
                      onToggle={() => setShowSort((v) => !v)}
                      onAdd={addSort}
                    />
                    {showSort && (
                      <>
                        {(config.sort ?? []).map((s, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/20 p-1.5">
                            <Select
                              value={s.field}
                              onValueChange={(v) => updateSort(i, { field: v })}
                            >
                              <SelectTrigger className="h-6 flex-1 text-xs">
                                <SelectValue placeholder="campo" />
                              </SelectTrigger>
                              <SelectContent>
                                {allFields.map((fd) => (
                                  <SelectItem key={fd.name} value={fd.name}>
                                    <span className="flex items-center gap-1.5">
                                      {fd.name.includes('.') && (
                                        <Link2 size={9} className="text-muted-foreground" />
                                      )}
                                      {fd.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button
                              className="shrink-0 rounded border px-1.5 py-0.5 text-xs hover:bg-muted transition-colors"
                              onClick={() =>
                                updateSort(i, {
                                  direction: s.direction === 'asc' ? 'desc' : 'asc',
                                })
                              }
                              title={s.direction === 'asc' ? 'Ascendente' : 'Descendente'}
                            >
                              {s.direction === 'asc' ? (
                                <ArrowUp size={11} />
                              ) : (
                                <ArrowDown size={11} />
                              )}
                            </button>
                            <button
                              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => removeSort(i)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {!config.sort?.length && (
                          <p className="text-xs text-muted-foreground">Sem ordenação</p>
                        )}
                      </>
                    )}
                  </div>

                  <Separator />

                  {/* ── Options (Group By + Limit) ── */}
                  <div className="space-y-2">
                    <button
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowOptions((v) => !v)}
                    >
                      {showOptions ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <SlidersHorizontal size={11} />
                      Opções
                    </button>
                    {showOptions && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Group By</Label>
                          <Select
                            value={config.groupBy?.[0] ?? '__none__'}
                            onValueChange={(v) =>
                              setConfig((c) => ({ ...c, groupBy: v === '__none__' ? [] : [v] }))
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {allFields.map((fd) => (
                                <SelectItem key={fd.name} value={fd.name}>
                                  <span className="flex items-center gap-1.5">
                                    {fd.name.includes('.') && (
                                      <Link2 size={9} className="text-muted-foreground" />
                                    )}
                                    {fd.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Limite</Label>
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            value={config.limit ?? 1000}
                            onChange={(e) =>
                              setConfig((c) => ({
                                ...c,
                                limit: parseInt(e.target.value) || 1000,
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Visualization panel ── */
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tipo de visualização</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VIZ_TYPES.map(({ type, label, icon }) => (
                    <button
                      key={type}
                      onClick={() => setVizType(type)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-md border p-2.5 text-xs transition-colors',
                        vizType === type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {vizType === 'TABLE' ? (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Columns3 size={11} />
                      Colunas visíveis
                    </Label>
                    {resultFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Execute a query primeiro</p>
                    ) : (
                      <div className="space-y-1">
                        {resultFields.map((col, idx) => {
                          const visible = visibleColumns ? visibleColumns.includes(col) : col !== '_id'
                          return (
                            <div key={col} className="flex items-center gap-2">
                              <Checkbox
                                id={`col-${col}`}
                                checked={visible}
                                onCheckedChange={(v) => {
                                  const current = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                                  const next = v
                                    ? [...current, col]
                                    : current.filter((c) => c !== col)
                                  setVisibleColumns(next)
                                  if (!config.aggregations?.length) {
                                    setConfig((c) => ({ ...c, projections: next }))
                                  }
                                }}
                                className="size-3.5"
                              />
                              <label
                                htmlFor={`col-${col}`}
                                className="flex flex-1 cursor-pointer items-center gap-1 truncate text-xs"
                              >
                                {col.includes('.') && <Link2 size={9} className="text-muted-foreground shrink-0" />}
                                {col}
                              </label>
                              <div className="flex gap-0.5">
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const cols = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                                    const i = cols.indexOf(col)
                                    if (i <= 0) return
                                    const next = [...cols]
                                    ;[next[i - 1]!, next[i]!] = [next[i]!, next[i - 1]!]
                                    setVisibleColumns(next)
                                  }}
                                >
                                  <MoveUp size={11} />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                                  disabled={idx === resultFields.length - 1}
                                  onClick={() => {
                                    const cols = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                                    const i = cols.indexOf(col)
                                    if (i < 0 || i >= cols.length - 1) return
                                    const next = [...cols]
                                    ;[next[i]!, next[i + 1]!] = [next[i + 1]!, next[i]!]
                                    setVisibleColumns(next)
                                  }}
                                >
                                  <MoveDown size={11} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {config.aggregations?.length ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Colunas determinadas pelas métricas
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Sem aggregations: colunas salvam como projeções
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Mapeamento de campos</Label>

                    {vizType !== 'KPI' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Eixo X</Label>
                        <Select value={xField} onValueChange={setXField}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {resultFields.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {vizType === 'KPI' ? 'Campo de valor' : 'Eixo Y'}
                      </Label>
                      <Select value={yField} onValueChange={setYField}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecione o campo" />
                        </SelectTrigger>
                        <SelectContent>
                          {resultFields.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {vizType === 'KPI' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Label</Label>
                        <Input
                          className="h-8 text-sm"
                          value={vizLabel}
                          onChange={(e) => setVizLabel(e.target.value)}
                          placeholder="ex: Receita Total"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Main area ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Results area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {results === null ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Play size={36} className="opacity-20" />
                <p className="text-sm">
                  {!dataSourceId
                    ? 'Selecione um data source para começar'
                    : !collection
                      ? 'Selecione uma collection para começar'
                      : 'Clique em Run para ver os resultados'}
                </p>
                {dataSourceId && collection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRun}
                    disabled={isRunning}
                    className="gap-1.5"
                  >
                    {isRunning ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Play size={11} />
                    )}
                    {isRunning ? 'Rodando…' : 'Executar Query'}
                  </Button>
                )}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Nenhum resultado retornado
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {results.length} linha{results.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {vizType.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                  {(config.lookups?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Link2 size={10} />
                      {config.lookups!.length} join{config.lookups!.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                  {vizType === 'TABLE' ? (
                    <ResultsTable
                      data={results}
                      visibleColumns={visibleColumns ?? undefined}
                      onVisibleColumnsChange={(cols) => {
                        setVisibleColumns(cols)
                        if (!config.aggregations?.length) {
                          setConfig((c) => ({ ...c, projections: cols }))
                        }
                      }}
                      sort={config.sort}
                      onSortToggle={handleSortToggle}
                    />
                  ) : (
                    <ChartRenderer
                      type={vizType}
                      data={results}
                      configuration={{ xField, yField, label: vizLabel }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── AI panel (slide-in from right) ── */}
          {aiOpen && (
            <div className="flex w-80 shrink-0 flex-col border-l bg-background">
              {/* AI panel header */}
              <div className="flex items-center gap-2 border-b px-4 py-3"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, transparent 100%)',
                }}
              >
                <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                  <Sparkles size={14} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Assistente IA</p>
                  <p className="text-[11px] text-muted-foreground">
                    Descreva o gráfico que você quer
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setAiOpen(false)}
                >
                  <X size={13} />
                </Button>
              </div>

              {/* Context info */}
              <div className="border-b px-4 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Database size={10} />
                  <span className="truncate">{collection}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0">{fields.length} campos</span>
                </div>
              </div>

              {/* Fields preview */}
              <div className="shrink-0 overflow-y-auto border-b px-4 py-2 max-h-36">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Campos disponíveis
                </p>
                <div className="flex flex-wrap gap-1">
                  {fields.slice(0, 20).map((f) => (
                    <span
                      key={f.name}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px]',
                        TYPE_COLORS[f.type] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {f.name}
                    </span>
                  ))}
                  {fields.length > 20 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      +{fields.length - 20} mais
                    </span>
                  )}
                </div>
              </div>

              {/* Prompt textarea */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Sua solicitação</Label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiGenerate()
                    }}
                    placeholder={`Ex: "Mostre o total de vendas por mês em um gráfico de barras"\n\nCtrl+Enter para gerar`}
                    rows={5}
                    className="w-full resize-none rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>

                <Button
                  onClick={handleAiGenerate}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Gerando…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Gerar configuração
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  A IA irá configurar filtros, métricas e o tipo de visualização. Você pode ajustar depois.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
