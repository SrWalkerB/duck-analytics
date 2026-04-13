import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  ArrowLeft,
  Play,
  Database,
  Table2,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Sparkles,
  Link2,
  X,
  Loader2,
  Columns3,
  GripVertical,
  Gauge,
  Plus,
} from 'lucide-react'
import { api } from '@/services/api'
import { AlertTriangle } from 'lucide-react'
import type {
  DataSource,
  FieldSchema,
  QueryConfiguration,
  ComponentType,
  Component,
  Query,
  PipelineConfiguration,
  PipelineStage,
  ChartDisplayConfig,
} from '@/types'
import { isPipelineConfiguration } from '@/types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChartRenderer } from '@/components/visualizations/ChartRenderer'
import { ChartOptionsPanel } from '@/components/visualizations/ChartOptionsPanel'
import { ResultsTable } from '@/components/question-editor/ResultsTable'
import { CollectionCombobox } from '@/components/question-editor/CollectionCombobox'
import { PipelineBuilder } from '@/components/question-editor/PipelineBuilder'
import { getQuestionCollectionDestination } from '@/components/question-editor/navigation'
import { usePipelineState } from '@/hooks/use-pipeline-state'
import { toast } from '@/lib/toast'
import { flattenRows } from '@/lib/flatten-row'
import {
  detectColumnType,
  DEFAULT_DATE_FORMAT,
  DEFAULT_NUMBER_FORMAT,
  type ColumnFormat,
  type ColumnType,
} from '@/lib/column-format'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Mode = 'editor' | 'visualization'

const VIZ_TYPES: { type: ComponentType; label: string; icon: React.ReactNode }[] = [
  { type: 'TABLE', label: 'Table', icon: <Table2 size={18} /> },
  { type: 'BAR_CHART', label: 'Bar', icon: <BarChart2 size={18} /> },
  { type: 'LINE_CHART', label: 'Line', icon: <LineChart size={18} /> },
  { type: 'PIE_CHART', label: 'Pie', icon: <PieChart size={18} /> },
  { type: 'KPI', label: 'KPI', icon: <Hash size={18} /> },
  { type: 'PROGRESS_BAR', label: 'Progress', icon: <Activity size={18} /> },
  { type: 'GAUGE', label: 'Gauge', icon: <Gauge size={18} /> },
]

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

// Convert v1 QueryConfiguration to v2 PipelineConfiguration
function convertLegacyToPipeline(cfg: QueryConfiguration): PipelineConfiguration {
  const stages: PipelineConfiguration['stages'] = []

  for (const lookup of cfg.lookups ?? []) {
    stages.push({
      id: crypto.randomUUID(),
      enabled: true,
      type: '$lookup',
      from: lookup.from,
      localField: lookup.localField,
      foreignField: lookup.foreignField,
      as: lookup.as,
      unwind: lookup.unwind,
    })
  }

  if (cfg.filters && cfg.filters.length > 0) {
    stages.push({
      id: crypto.randomUUID(),
      enabled: true,
      type: '$match',
      filters: cfg.filters,
    })
  }

  if (cfg.aggregations && cfg.aggregations.length > 0) {
    stages.push({
      id: crypto.randomUUID(),
      enabled: true,
      type: '$group',
      groupBy: cfg.groupBy ?? [],
      aggregations: cfg.aggregations,
    })
  }

  if (
    cfg.projections &&
    cfg.projections.length > 0 &&
    (!cfg.aggregations || cfg.aggregations.length === 0)
  ) {
    stages.push({
      id: crypto.randomUUID(),
      enabled: true,
      type: '$project',
      include: cfg.projections,
    })
  }

  if (cfg.sort && cfg.sort.length > 0) {
    stages.push({
      id: crypto.randomUUID(),
      enabled: true,
      type: '$sort',
      sort: cfg.sort,
    })
  }

  stages.push({
    id: crypto.randomUUID(),
    enabled: true,
    type: '$limit',
    limit: cfg.limit ?? 1000,
  })

  return { version: 2, stages }
}

function getInitialPipelineConfig(query?: Query): PipelineConfiguration | undefined {
  if (!query) return undefined
  if (isPipelineConfiguration(query.configuration)) {
    return query.configuration
  }
  return convertLegacyToPipeline(query.configuration as QueryConfiguration)
}

const STAGE_LABELS: Record<string, string> = {
  $match: 'Filtrar',
  $lookup: 'Join',
  $group: 'Agrupar',
  $sort: 'Ordenar',
  $project: 'Projeção',
  $unwind: 'Unwind',
}

function getFieldUsages(field: string, stages: PipelineStage[]): string[] {
  const usages: string[] = []
  for (const stage of stages) {
    if (!stage.enabled) continue
    const label = STAGE_LABELS[stage.type] ?? stage.type
    switch (stage.type) {
      case '$match':
        if (stage.filters.some((f) => f.field === field))
          usages.push(`${label} ($match) — filtro pelo campo "${field}"`)
        break
      case '$lookup':
        if (stage.localField === field)
          usages.push(`${label} ($lookup) — campo local "${field}" → ${stage.from}`)
        break
      case '$group':
        if (stage.groupBy.includes(field))
          usages.push(`${label} ($group) — agrupamento por "${field}"`)
        if (stage.aggregations.some((a) => a.field === field))
          usages.push(`${label} ($group) — agregação no campo "${field}"`)
        break
      case '$sort':
        if (stage.sort.some((s) => s.field === field))
          usages.push(`${label} ($sort) — ordenação por "${field}"`)
        break
      case '$project':
        if (stage.include.includes(field))
          usages.push(`${label} ($project) — projeção inclui "${field}"`)
        break
      case '$unwind':
        if (stage.path === field)
          usages.push(`${label} ($unwind) — desaninhando "${field}"`)
        break
    }
  }
  return usages
}

function SortableColumnItem({
  col,
  visible,
  alias,
  detectedType,
  format,
  onToggle,
  onAliasChange,
  onFormatChange,
}: {
  col: string
  visible: boolean
  alias: string
  detectedType: ColumnType
  format: ColumnFormat | undefined
  onToggle: () => void
  onAliasChange: (value: string) => void
  onFormatChange: (value: ColumnFormat | undefined) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const typeLabel: Record<ColumnType, string> = {
    date: 'Data',
    number: 'Número',
    boolean: 'Booleano',
    text: 'Texto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border p-2 space-y-1.5',
        visible ? 'bg-muted/30' : 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical size={12} />
        </button>
        <Checkbox
          checked={visible}
          onCheckedChange={() => onToggle()}
          className="size-3.5"
        />
        <span className="flex-1 truncate text-xs font-medium">
          {col.includes('.') && <Link2 size={9} className="mr-1 inline text-muted-foreground" />}
          {col}
        </span>
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
          {typeLabel[detectedType]}
        </Badge>
      </div>
      {visible && (
        <>
          <Input
            value={alias}
            onChange={(e) => onAliasChange(e.target.value)}
            placeholder="Nome de exibição"
            className="h-7 text-xs"
          />
          {(detectedType === 'date' || detectedType === 'number') && (
            <ColumnFormatPopover
              detectedType={detectedType}
              format={format}
              onFormatChange={onFormatChange}
            />
          )}
        </>
      )}
    </div>
  )
}

function ColumnFormatPopover({
  detectedType,
  format,
  onFormatChange,
}: {
  detectedType: 'date' | 'number'
  format: ColumnFormat | undefined
  onFormatChange: (value: ColumnFormat | undefined) => void
}) {
  const effective: ColumnFormat =
    format ??
    (detectedType === 'date'
      ? DEFAULT_DATE_FORMAT
      : DEFAULT_NUMBER_FORMAT)

  const summary = (() => {
    if (effective.type === 'date') {
      const s = effective.separator === 'slash' ? '/' : effective.separator === 'dash' ? '-' : '.'
      const order =
        effective.order === 'DMY' ? `DD${s}MM${s}YYYY`
          : effective.order === 'MDY' ? `MM${s}DD${s}YYYY`
            : `YYYY${s}MM${s}DD`
      const time =
        effective.time === 'off' ? ''
          : effective.time === 'hm' ? ' HH:MM'
            : effective.time === 'hms' ? ' HH:MM:SS'
              : ' HH:MM:SS.MS'
      return `${order}${time}`
    }
    const parts: string[] = []
    if (effective.prefix) parts.push(effective.prefix)
    parts.push(`0${effective.decimals > 0 ? '.' + '0'.repeat(effective.decimals) : ''}`)
    if (effective.suffix) parts.push(effective.suffix)
    return parts.join('')
  })()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-between text-[10px] font-normal">
          <span className="truncate">{summary}</span>
          <span className="text-muted-foreground">Formato</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {effective.type === 'date' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Separador</Label>
              <Select
                value={effective.separator}
                onValueChange={(v) =>
                  onFormatChange({ ...effective, separator: v as 'slash' | 'dash' | 'dot' })
                }
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slash">/ (barra)</SelectItem>
                  <SelectItem value="dash">- (hífen)</SelectItem>
                  <SelectItem value="dot">. (ponto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ordem</Label>
              <Select
                value={effective.order}
                onValueChange={(v) =>
                  onFormatChange({ ...effective, order: v as 'DMY' | 'MDY' | 'YMD' })
                }
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DMY">Dia / Mês / Ano</SelectItem>
                  <SelectItem value="MDY">Mês / Dia / Ano</SelectItem>
                  <SelectItem value="YMD">Ano / Mês / Dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mostrar a hora</Label>
              <Select
                value={effective.time}
                onValueChange={(v) =>
                  onFormatChange({ ...effective, time: v as 'off' | 'hm' | 'hms' | 'hmsms' })
                }
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Desligado</SelectItem>
                  <SelectItem value="hm">HH:MM</SelectItem>
                  <SelectItem value="hms">HH:MM:SS</SelectItem>
                  <SelectItem value="hmsms">HH:MM:SS.MS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {format && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-full text-[10px]"
                onClick={() => onFormatChange(undefined)}
              >
                Restaurar padrão
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Casas decimais</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={effective.decimals}
                onChange={(e) =>
                  onFormatChange({
                    ...effective,
                    decimals: Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                  })
                }
                className="h-7 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={effective.thousands}
                onCheckedChange={(v) =>
                  onFormatChange({ ...effective, thousands: Boolean(v) })
                }
                className="size-3.5"
              />
              <Label className="text-xs">Separador de milhares</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prefixo</Label>
              <Input
                value={effective.prefix ?? ''}
                onChange={(e) =>
                  onFormatChange({ ...effective, prefix: e.target.value || undefined })
                }
                placeholder="Ex.: R$"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sufixo</Label>
              <Input
                value={effective.suffix ?? ''}
                onChange={(e) =>
                  onFormatChange({ ...effective, suffix: e.target.value || undefined })
                }
                placeholder="Ex.: %"
                className="h-7 text-xs"
              />
            </div>
            {format && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-full text-[10px]"
                onClick={() => onFormatChange(undefined)}
              >
                Restaurar padrão
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function EditableQuestionTitle({
  value,
  onCommit,
}: {
  value: string
  onCommit: (nextValue: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function startEdit() {
    setDraft(value)
    setIsEditing(true)
  }

  function commit() {
    onCommit(draft)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="h-7 w-56 text-sm font-medium"
        placeholder="Digite um título..."
      />
    )
  }

  return (
    <button
      className={cn(
        'h-7 max-w-xs truncate rounded-md px-2 text-left text-sm font-medium transition-colors',
        value.trim()
          ? 'border border-transparent hover:border-border hover:bg-muted/40 hover:text-muted-foreground'
          : 'border border-dashed border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40',
      )}
      onClick={startEdit}
      title="Clique para renomear"
    >
      {value.trim() || 'Digite um título...'}
    </button>
  )
}

interface Props {
  initialQuery?: Query
  initialComponent?: Component
  folderId?: string
}

export function QuestionEditor({ initialQuery, initialComponent, folderId }: Props) {
  const navigate = useNavigate()
  const backDestination = getQuestionCollectionDestination(
    initialComponent?.folderId ?? folderId,
  )

  const [name, setName] = useState(
    initialComponent?.name ?? initialQuery?.name ?? 'Sem título',
  )
  const [mode, setMode] = useState<Mode>('editor')

  // Resizable left panel — persisted locally. Min/max chosen so the user
  // can read long nested dot-paths like `questions.<uuid>-title` without
  // collapsing the results pane.
  const SIDEBAR_MIN = 280
  const SIDEBAR_MAX = 720
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 320
    const saved = Number(localStorage.getItem('questionEditor.sidebarWidth'))
    if (Number.isFinite(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
      return saved
    }
    return 320
  })
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!isResizingRef.current || !sidebarRef.current) return
      const rect = sidebarRef.current.getBoundingClientRect()
      const next = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, e.clientX - rect.left),
      )
      setSidebarWidth(next)
    }
    function onUp() {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('questionEditor.sidebarWidth', String(sidebarWidth))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [sidebarWidth])

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Query state
  const [dataSourceId, setDataSourceId] = useState(initialQuery?.dataSourceId ?? '')
  const [collection, setCollection] = useState(initialQuery?.collection ?? '')

  // Pipeline state (v2)
  const pipeline = usePipelineState(getInitialPipelineConfig(initialQuery))

  // Viz state
  const [vizType, setVizType] = useState<ComponentType>(initialComponent?.type ?? 'TABLE')
  const [xField, setXField] = useState(
    (initialComponent?.configuration['xField'] as string) ?? '',
  )
  const [yFields, setYFields] = useState<string[]>(() => {
    const arr = initialComponent?.configuration['yFields'] as string[] | undefined
    if (arr?.length) return arr
    const single = initialComponent?.configuration['yField'] as string | undefined
    return single ? [single] : ['']
  })
  const [vizLabel, setVizLabel] = useState(
    (initialComponent?.configuration['label'] as string) ?? '',
  )
  const [displayConfig, setDisplayConfig] = useState<ChartDisplayConfig>(
    (initialComponent?.configuration['display'] as ChartDisplayConfig) ?? {},
  )
  const [goalField, setGoalField] = useState(
    (initialComponent?.configuration['goalField'] as string) ?? '',
  )
  const [goalValue, setGoalValue] = useState(
    (initialComponent?.configuration['goalValue'] as number) ?? 0,
  )
  const [goalSource, setGoalSource] = useState<'field' | 'fixed'>(
    (initialComponent?.configuration['goalField'] as string) ? 'field' : 'fixed',
  )

  // Results
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Dirty state
  const lastRunConfig = useRef<string | null>(null)
  const isDirty = useMemo(() => {
    if (!results) return false
    return lastRunConfig.current !== JSON.stringify({ dataSourceId, collection, config: pipeline.config })
  }, [results, dataSourceId, collection, pipeline.config])

  // Visible columns for TABLE mode
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null)

  // Column aliases for TABLE mode
  const [columnAliases, setColumnAliases] = useState<Record<string, string>>(
    (initialComponent?.configuration?.['columnAliases'] as Record<string, string>) ?? {},
  )

  // Table display options (TABLE mode)
  const [paginationMode, setPaginationMode] = useState<'infinite' | 'paginated'>(
    (initialComponent?.configuration?.['paginationMode'] as 'infinite' | 'paginated') ?? 'paginated',
  )
  const [pageSize, setPageSize] = useState<number>(
    (initialComponent?.configuration?.['pageSize'] as number) ?? 100,
  )
  const [exportFormats, setExportFormats] = useState<Array<'csv' | 'excel'>>(
    (initialComponent?.configuration?.['exportFormats'] as Array<'csv' | 'excel'>) ?? ['csv', 'excel'],
  )
  const [columnFormats, setColumnFormats] = useState<Record<string, ColumnFormat>>(
    (initialComponent?.configuration?.['columnFormats'] as Record<string, ColumnFormat>) ?? {},
  )

  // Flatten result rows so that nested fields selected via $project (e.g.
  // `collectedItem.title`) surface as flat columns. MongoDB returns
  // `{ collectedItem: { title: '...' } }` for a projection of
  // `collectedItem.title`; without flattening the column picker only sees
  // the top-level `collectedItem` key and the selected leaf is invisible.
  const flatResults = useMemo<Record<string, unknown>[] | null>(() => {
    if (!results) return null
    return flattenRows(results)
  }, [results])

  // Auto-detect each column's type based on the current result rows.
  const detectedColumnTypes = useMemo<Record<string, ColumnType>>(() => {
    const rows = (flatResults ?? []) as Record<string, unknown>[]
    if (rows.length === 0) return {}
    const allCols = new Set<string>()
    for (const row of rows.slice(0, 50)) {
      for (const k of Object.keys(row)) allCols.add(k)
    }
    const out: Record<string, ColumnType> = {}
    for (const c of allCols) out[c] = detectColumnType(rows, c)
    return out
  }, [flatResults])

  // DnD sensors for column reordering
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Column usage alert dialog
  const [columnAlert, setColumnAlert] = useState<{ col: string; usages: string[] } | null>(null)

  function tryToggleColumn(col: string, currentVisible: string[]) {
    const isVisible = currentVisible.includes(col)
    if (isVisible) {
      // Trying to hide — check if used in pipeline
      const usages = getFieldUsages(col, pipeline.stages)
      if (usages.length > 0) {
        setColumnAlert({ col, usages })
        return
      }
    }
    const next = isVisible
      ? currentVisible.filter((c) => c !== col)
      : [...currentVisible, col]
    setVisibleColumns(next)
  }

  // AI panel
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => api.get('/v1/data-sources').then((r) => r.data),
  })

  const { data: collectionsData, isLoading: isLoadingCollections } = useQuery<{
    collections: string[]
  }>({
    queryKey: ['ds-collections', dataSourceId],
    queryFn: () =>
      api.get(`/v1/data-sources/${dataSourceId}/collections`).then((r) => r.data),
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

  const fields = schema?.fields ?? []

  const selectedDataSourceType = useMemo(() => {
    return dataSources?.find((ds) => ds.id === dataSourceId)?.type ?? 'MONGODB'
  }, [dataSources, dataSourceId])

  const sortedCollections = useMemo(() => {
    const list = collectionsData?.collections ?? []
    return [...list].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [collectionsData])

  const resultFields = useMemo(() => {
    if (flatResults && flatResults.length > 0) {
      // Union of keys across the first few flattened rows so sparse nested
      // fields (not present in row 0) still show up in the column picker.
      const cols = new Set<string>()
      for (const row of flatResults.slice(0, 50)) {
        for (const k of Object.keys(row)) cols.add(k)
      }
      return [...cols]
    }
    return fields.map((f) => f.name)
  }, [flatResults, fields])

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

  function handleDataSourceChange(v: string) {
    setDataSourceId(v)
    setCollection('')
    pipeline.setAllStages([])
    setResults(null)
  }

  function handleCollectionChange(v: string) {
    setCollection(v)
    pipeline.setAllStages([])
    setResults(null)
  }

  async function handleRun() {
    if (!dataSourceId || !collection) return
    setIsRunning(true)
    try {
      const res = await api.post('/v1/queries/preview', {
        dataSourceId,
        collection,
        configuration: pipeline.config,
      })
      const data = res.data.data as Record<string, unknown>[]
      setResults(data)
      lastRunConfig.current = JSON.stringify({
        dataSourceId,
        collection,
        config: pipeline.config,
      })
      if (data.length > 0) {
        const cols = Object.keys(data[0]!)
        if (!xField && cols[0]) setXField(cols[0])
        if (!yFields.filter(Boolean).length && cols[1]) setYFields([cols[1]])
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
      const filteredYFields = yFields.filter(Boolean)
      const vizConf: Record<string, unknown> = {
        xField,
        yField: filteredYFields[0] ?? '',
        yFields: filteredYFields,
        label: vizLabel,
        display: displayConfig,
        columnAliases: Object.keys(columnAliases).length > 0 ? columnAliases : undefined,
        columnOrder: visibleColumns ?? undefined,
        paginationMode,
        pageSize,
        exportFormats,
        columnFormats: Object.keys(columnFormats).length > 0 ? columnFormats : undefined,
        ...((vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && goalSource === 'field' && goalField
          ? { goalField }
          : {}),
        ...((vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && goalSource === 'fixed' && goalValue
          ? { goalValue }
          : {}),
      }
      let queryId = initialQuery?.id

      if (initialQuery) {
        await api.put(`/v1/queries/${initialQuery.id}`, {
          name,
          dataSourceId,
          collection,
          configuration: pipeline.config,
        })
      } else {
        const qRes = await api.post('/v1/queries', {
          name,
          dataSourceId,
          collection,
          configuration: pipeline.config,
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
          folderId: folderId || undefined,
        })
      }

      toast.success('Salvo!')
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
      // AI returns v1 config — convert to v2
      const converted = convertLegacyToPipeline(g.configuration ?? {})
      pipeline.setAllStages(converted.stages)
      setVizType(g.vizType ?? 'TABLE')
      if (g.xField) setXField(g.xField)
      if (g.yField) setYFields([g.yField])
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

  // Sort toggle from table header
  function handleSortToggle(field: string) {
    // Find existing sort stage or create one
    const sortStage = pipeline.stages.find((s) => s.type === '$sort')
    if (sortStage && sortStage.type === '$sort') {
      const sorts = [...sortStage.sort]
      const idx = sorts.findIndex((s) => s.field === field)
      if (idx === -1) {
        pipeline.updateStage(sortStage.id, {
          sort: [...sorts, { field, direction: 'asc' as const }],
        })
      } else if (sorts[idx]!.direction === 'asc') {
        sorts[idx] = { field, direction: 'desc' as const }
        pipeline.updateStage(sortStage.id, { sort: sorts })
      } else {
        pipeline.updateStage(sortStage.id, {
          sort: sorts.filter((_, j) => j !== idx),
        })
      }
    } else {
      pipeline.addStage('$sort')
      // The addStage will create a new sort stage; update it in next tick
      setTimeout(() => {
        const newSortStage = pipeline.stages.find((s) => s.type === '$sort')
        if (newSortStage) {
          pipeline.updateStage(newSortStage.id, {
            sort: [{ field, direction: 'asc' as const }],
          })
        }
      }, 0)
    }
  }

  // Get current sort config for table header display
  const currentSort = useMemo(() => {
    const sortStage = pipeline.stages.find((s) => s.type === '$sort' && s.enabled)
    if (sortStage && sortStage.type === '$sort') return sortStage.sort
    return undefined
  }, [pipeline.stages])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Top bar ── */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => navigate(backDestination)}
        >
          <ArrowLeft size={15} />
        </Button>
        <Separator orientation="vertical" className="h-full" />

        <EditableQuestionTitle key={name} value={name} onCommit={setName} />

        <div className="ml-auto flex items-center gap-2">
          {/* AI button */}
          <Button
            size="sm"
            variant={aiOpen ? 'default' : 'outline'}
            className={cn('h-8 gap-1.5 text-xs', !aiOpen && 'border-dashed')}
            onClick={() => setAiOpen((v) => !v)}
            disabled={!dataSourceId || !collection}
            title={
              !dataSourceId || !collection
                ? 'Selecione um data source e collection primeiro'
                : 'Gerar com IA'
            }
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
            {isRunning ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            {isRunning ? 'Rodando…' : 'Run'}
          </Button>

          <Button size="sm" className="h-8" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel (resizable) */}
        <div
          ref={sidebarRef}
          className="relative shrink-0 border-r"
          style={{ width: sidebarWidth }}
        >
          <div className="h-full overflow-y-auto">
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
                  <Label className="text-xs text-muted-foreground">
                    {selectedDataSourceType === 'POSTGRESQL' ? 'Tabela' : 'Collection'}
                  </Label>
                  <CollectionCombobox
                    collections={sortedCollections}
                    value={collection}
                    onChange={handleCollectionChange}
                    isLoading={isLoadingCollections}
                    dataSourceType={selectedDataSourceType}
                  />
                </div>
              )}

              {collection && (
                <>
                  <Separator />
                  {/* Pipeline Builder */}
                  <PipelineBuilder
                    stages={pipeline.stages}
                    config={pipeline.config}
                    baseFields={fields}
                    dataSourceId={dataSourceId}
                    collection={collection}
                    collections={sortedCollections}
                    dataSourceType={selectedDataSourceType}
                    onAddStage={pipeline.addStage}
                    onUpdateStage={pipeline.updateStage}
                    onRemoveStage={pipeline.removeStage}
                    onToggleStage={pipeline.toggleStage}
                    onMoveStage={pipeline.moveStage}
                    onPartialResult={setResults}
                  />
                </>
              )}
            </div>
          ) : (
            /* ── Visualization panel ── */
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Tipo de visualização
                </Label>
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
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Columns3 size={11} />
                        Colunas
                      </Label>
                      {resultFields.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] px-1.5"
                          onClick={() => {
                            const currentVisible = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                            const allVisible = currentVisible.length === resultFields.length
                            if (allVisible) {
                              // Check if any visible column is used in the pipeline
                              const allUsages: string[] = []
                              for (const col of currentVisible) {
                                allUsages.push(...getFieldUsages(col, pipeline.stages))
                              }
                              if (allUsages.length > 0) {
                                setColumnAlert({ col: '(todos)', usages: allUsages })
                                return
                              }
                              setVisibleColumns([])
                            } else {
                              setVisibleColumns([...resultFields])
                            }
                          }}
                        >
                          {(visibleColumns ?? resultFields.filter((c) => c !== '_id')).length === resultFields.length
                            ? 'Desmarcar todos'
                            : 'Marcar todos'}
                        </Button>
                      )}
                    </div>
                    {resultFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Execute a query primeiro
                      </p>
                    ) : (
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event: DragEndEvent) => {
                          const { active, over } = event
                          if (!over || active.id === over.id) return
                          const cols = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                          const oldIndex = cols.indexOf(String(active.id))
                          const newIndex = cols.indexOf(String(over.id))
                          if (oldIndex === -1 || newIndex === -1) return
                          const next = [...cols]
                          const [moved] = next.splice(oldIndex, 1)
                          next.splice(newIndex, 0, moved!)
                          setVisibleColumns(next)
                        }}
                      >
                        <SortableContext
                          items={visibleColumns ?? resultFields.filter((c) => c !== '_id')}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-1.5">
                            {(() => {
                              const currentVisible = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                              const hidden = resultFields.filter((c) => !currentVisible.includes(c))
                              return [...currentVisible, ...hidden]
                            })().map((col) => {
                              const currentVisible = visibleColumns ?? resultFields.filter((c) => c !== '_id')
                              const visible = currentVisible.includes(col)
                              return (
                                <SortableColumnItem
                                  key={col}
                                  col={col}
                                  visible={visible}
                                  alias={columnAliases[col] ?? ''}
                                  detectedType={detectedColumnTypes[col] ?? 'text'}
                                  format={columnFormats[col]}
                                  onToggle={() => tryToggleColumn(col, currentVisible)}
                                  onAliasChange={(value) => {
                                    setColumnAliases((prev) => {
                                      if (!value) {
                                        const next = { ...prev }
                                        delete next[col]
                                        return next
                                      }
                                      return { ...prev, [col]: value }
                                    })
                                  }}
                                  onFormatChange={(value) => {
                                    setColumnFormats((prev) => {
                                      if (!value) {
                                        const next = { ...prev }
                                        delete next[col]
                                        return next
                                      }
                                      return { ...prev, [col]: value }
                                    })
                                  }}
                                />
                              )
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Linhas por página</Label>
                    <Input
                      type="number"
                      min={10}
                      max={1000}
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(Math.max(10, Number(e.target.value) || 100))
                      }
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Modo de navegação</Label>
                    <Select
                      value={paginationMode}
                      onValueChange={(v) => setPaginationMode(v as 'infinite' | 'paginated')}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paginated">Paginação</SelectItem>
                        <SelectItem value="infinite">Infinite Scroll</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Formatos de exportação permitidos
                    </Label>
                    <div className="flex flex-col gap-1.5">
                      {(['csv', 'excel'] as const).map((fmt) => {
                        const checked = exportFormats.includes(fmt)
                        return (
                          <label
                            key={fmt}
                            className="flex cursor-pointer items-center gap-2 text-xs"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setExportFormats((prev) =>
                                  v
                                    ? Array.from(new Set([...prev, fmt]))
                                    : prev.filter((f) => f !== fmt),
                                )
                              }}
                              className="size-3.5"
                            />
                            <span className="uppercase">{fmt}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      Mapeamento de campos
                    </Label>

                    {vizType !== 'KPI' && vizType !== 'PROGRESS_BAR' && vizType !== 'GAUGE' && (
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
                        {vizType === 'KPI' || vizType === 'PROGRESS_BAR' || vizType === 'GAUGE' ? 'Campo de valor' : 'Eixo Y'}
                      </Label>
                      {vizType === 'KPI' || vizType === 'PROGRESS_BAR' || vizType === 'GAUGE' ? (
                        <Select value={yFields[0] ?? ''} onValueChange={(v) => setYFields([v])}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {resultFields.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-1.5">
                          {yFields.map((field, idx) => (
                            <div key={idx} className="flex gap-1.5">
                              <Select value={field} onValueChange={(v) => {
                                const next = [...yFields]; next[idx] = v; setYFields(next)
                              }}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Selecione o campo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {resultFields.map((f) => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {yFields.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                  onClick={() => setYFields(yFields.filter((_, i) => i !== idx))}>
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => setYFields([...yFields, ''])}>
                            <Plus className="mr-1 h-3 w-3" /> Adicionar série
                          </Button>
                        </div>
                      )}
                    </div>

                    {(vizType === 'KPI' || vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && (
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

                    {(vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Origem da meta</Label>
                          <Select
                            value={goalSource}
                            onValueChange={(v) => setGoalSource(v as 'field' | 'fixed')}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="field">Campo da query</SelectItem>
                              <SelectItem value="fixed">Valor fixo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {goalSource === 'field' ? (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Campo da meta</Label>
                            <Select value={goalField} onValueChange={setGoalField}>
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
                        ) : (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Valor da meta</Label>
                            <Input
                              type="number"
                              className="h-8 text-sm"
                              value={goalValue || ''}
                              onChange={(e) => setGoalValue(Number(e.target.value))}
                              placeholder="ex: 100"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <ChartOptionsPanel
                    type={vizType}
                    data={flatResults ?? []}
                    xField={xField}
                    yFields={yFields.filter(Boolean)}
                    config={displayConfig}
                    onChange={setDisplayConfig}
                  />
                </>
              )}
            </div>
          )}
          </div>
          {/* Drag handle to resize the sidebar */}
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startResize}
            className="absolute inset-y-0 right-0 z-10 w-1.5 -translate-x-px cursor-col-resize bg-transparent hover:bg-primary/30 active:bg-primary/50"
            title="Arraste para redimensionar"
          />
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
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                  {vizType === 'TABLE' ? (
                    <ResultsTable
                      data={flatResults ?? results}
                      visibleColumns={visibleColumns ?? undefined}
                      onVisibleColumnsChange={(cols) => {
                        setVisibleColumns(cols)
                      }}
                      sort={currentSort}
                      onSortToggle={handleSortToggle}
                      columnAliases={Object.keys(columnAliases).length > 0 ? columnAliases : undefined}
                      columnOrder={visibleColumns ?? undefined}
                      exportFilename={name}
                      editable
                      paginationMode={paginationMode}
                      pageSize={pageSize}
                      exportFormats={exportFormats}
                      columnFormats={Object.keys(columnFormats).length > 0 ? columnFormats : undefined}
                    />
                  ) : (
                    <ChartRenderer
                      type={vizType}
                      data={flatResults ?? results}
                      configuration={{
                        xField,
                        yField: yFields.filter(Boolean)[0] ?? '',
                        yFields: yFields.filter(Boolean),
                        label: vizLabel,
                        display: displayConfig,
                        ...((vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && goalSource === 'field' && goalField
                          ? { goalField }
                          : {}),
                        ...((vizType === 'PROGRESS_BAR' || vizType === 'GAUGE') && goalSource === 'fixed' && goalValue
                          ? { goalValue }
                          : {}),
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── AI panel (slide-in from right) ── */}
          {aiOpen && (
            <div className="flex w-80 shrink-0 flex-col border-l bg-background">
              <div
                className="flex items-center gap-2 border-b px-4 py-3"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, transparent 100%)',
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

              <div className="border-b px-4 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Database size={10} />
                  <span className="truncate">{collection}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0">{fields.length} campos</span>
                </div>
              </div>

              <div className="max-h-36 shrink-0 overflow-y-auto border-b px-4 py-2">
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

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Sua solicitação
                  </Label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                        handleAiGenerate()
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
                  A IA irá configurar filtros, métricas e o tipo de visualização. Você
                  pode ajustar depois.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Column usage alert dialog */}
      <Dialog open={columnAlert !== null} onOpenChange={() => setColumnAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Campo em uso
            </DialogTitle>
            <DialogDescription>
              Não é possível ocultar este campo porque ele está sendo utilizado no pipeline:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-md bg-muted p-3">
            {columnAlert?.usages.map((usage, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                <span>{usage}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setColumnAlert(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
