import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, RefreshCw, ExternalLink, GitBranch, Columns2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { api } from '@/services/api'
import type {
  DataSource,
  DashboardFilter,
  DashboardComponent,
  DashboardTab,
  FilterTargetMapping,
  FieldSchema,
  MatchableField,
  Query,
} from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  dashboardId: string
  dashboardComponents: DashboardComponent[]
  tabs?: DashboardTab[]
  editingFilter?: DashboardFilter | null
}

export function FilterEditorPanel({
  open,
  onClose,
  dashboardId,
  dashboardComponents,
  tabs = [],
  editingFilter,
}: Props) {
  const qc = useQueryClient()

  const [label, setLabel] = useState('')
  const [sourceMode, setSourceMode] = useState<'simple' | 'query'>('simple')
  const [dataSourceId, setDataSourceId] = useState('')
  const [collection, setCollection] = useState('')
  const [field, setField] = useState('')
  const [selectedQueryId, setSelectedQueryId] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('MULTI_SELECT')
  const [collectionSearch, setCollectionSearch] = useState('')
  const [querySearch, setQuerySearch] = useState('')
  const [queryColumnSearch, setQueryColumnSearch] = useState('')
  const [targetMappings, setTargetMappings] = useState<
    Record<string, { enabled: boolean; targetField: string; valueField?: string; fieldType?: string }>
  >({})

  // Populate form when editing
  useEffect(() => {
    if (editingFilter) {
      setLabel(editingFilter.label)
      setSourceMode(editingFilter.queryId ? 'query' : 'simple')
      setDataSourceId(editingFilter.dataSourceId)
      setCollection(editingFilter.collection)
      setField(editingFilter.field)
      setSelectedQueryId(editingFilter.queryId ?? '')
      setFilterType(editingFilter.type)
      const mappings: Record<string, { enabled: boolean; targetField: string; valueField?: string; fieldType?: string }> = {}
      for (const m of editingFilter.targetMappings) {
        mappings[m.componentId] = { enabled: true, targetField: m.targetField, valueField: m.valueField, fieldType: m.fieldType }
      }
      setTargetMappings(mappings)
    } else {
      setLabel('')
      setSourceMode('simple')
      setDataSourceId('')
      setCollection('')
      setField('')
      setSelectedQueryId('')
      setFilterType('MULTI_SELECT')
      setTargetMappings({})
    }
  }, [editingFilter, open])

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => api.get('/v1/data-sources').then((r) => r.data),
    enabled: open,
  })

  const { data: collectionsData } = useQuery<{ collections: string[] }>({
    queryKey: ['ds-collections', dataSourceId],
    queryFn: () =>
      api.get(`/v1/data-sources/${dataSourceId}/collections`).then((r) => r.data),
    enabled: open && !!dataSourceId,
  })

  const { data: schemaData } = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', dataSourceId, collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${dataSourceId}/collections/${collection}/schema`)
        .then((r) => r.data),
    enabled: open && !!dataSourceId && !!collection,
  })

  const {
    data: queries,
    refetch: refetchQueries,
    isFetching: isFetchingQueries,
  } = useQuery<Query[]>({
    queryKey: ['queries'],
    queryFn: () => api.get('/v1/queries').then((r) => r.data),
    enabled: open && sourceMode === 'query',
  })

  // When in query mode with a selected query, derive dataSourceId/collection/field from the query
  const selectedQuery = queries?.find((q) => q.id === selectedQueryId)

  // Fetch schema for the selected query's collection (for the per-component valueField select)
  const { data: querySchemaData } = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', selectedQuery?.dataSourceId, selectedQuery?.collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${selectedQuery!.dataSourceId}/collections/${selectedQuery!.collection}/schema`)
        .then((r) => r.data),
    enabled: open && sourceMode === 'query' && !!selectedQuery,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mappings: FilterTargetMapping[] = []
      for (const [componentId, m] of Object.entries(targetMappings)) {
        if (m.enabled && m.targetField.trim()) {
          mappings.push({
            componentId,
            targetField: m.targetField.trim(),
            valueField: m.valueField || undefined,
            fieldType: m.fieldType,
          })
        }
      }

      const isQuery = sourceMode === 'query' && selectedQuery
      const payload = {
        label,
        type: filterType,
        field,
        collection: isQuery ? selectedQuery.collection : collection,
        dataSourceId: isQuery ? selectedQuery.dataSourceId : dataSourceId,
        parentFilterId: undefined,
        targetMappings: mappings,
        queryId: isQuery ? selectedQueryId : undefined,
      }

      if (editingFilter) {
        await api.put(
          `/v1/dashboards/${dashboardId}/filters/${editingFilter.id}`,
          payload,
        )
      } else {
        await api.post(`/v1/dashboards/${dashboardId}/filters`, payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
      toast.success(editingFilter ? 'Filtro atualizado' : 'Filtro criado')
      onClose()
    },
    onError: () => toast.error('Erro ao salvar filtro'),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(
        `/v1/dashboards/${dashboardId}/filters/${editingFilter!.id}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', dashboardId] })
      toast.success('Filtro excluído')
      onClose()
    },
    onError: () => toast.error('Erro ao excluir filtro'),
  })

  const collections = [...(collectionsData?.collections ?? [])].sort((a, b) => a.localeCompare(b))
  const filteredCollections = collectionSearch
    ? collections.filter((c) => c.toLowerCase().includes(collectionSearch.toLowerCase()))
    : collections
  const fields = schemaData?.fields ?? []
  const queryFields = querySchemaData?.fields ?? []
  const canSave =
    sourceMode === 'query'
      ? !!(label.trim() && selectedQueryId && field)
      : !!(label.trim() && dataSourceId && collection && field)

  function toggleComponent(componentId: string) {
    setTargetMappings((prev) => {
      const current = prev[componentId]
      if (current?.enabled) {
        const { [componentId]: _, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [componentId]: { enabled: true, targetField: current?.targetField ?? field },
      }
    })
  }

  function setComponentTargetField(componentId: string, targetField: string, fieldType?: string) {
    setTargetMappings((prev) => ({
      ...prev,
      [componentId]: { ...prev[componentId], enabled: true, targetField, fieldType },
    }))
  }

  function setComponentValueField(componentId: string, valueField: string) {
    setTargetMappings((prev) => ({
      ...prev,
      [componentId]: { ...prev[componentId], enabled: true, valueField: valueField || undefined },
    }))
  }

  // Fields available for valueField select (from the filter's source)
  const sourceFields = sourceMode === 'query' ? queryFields : fields

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-96 overflow-y-auto p-0" aria-describedby={undefined}>
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">
            {editingFilter ? 'Editar filtro' : 'Novo filtro'}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs">Etiqueta</Label>
            <Input
              className="h-8 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Marca, Produto..."
            />
          </div>

          {/* Source mode toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fonte dos valores</Label>
            <div className="flex gap-1 rounded-md border p-0.5">
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  sourceMode === 'simple'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setSourceMode('simple')
                  setSelectedQueryId('')
                }}
              >
                Simples
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  sourceMode === 'query'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setSourceMode('query')
                  setDataSourceId('')
                  setCollection('')
                  setField('')
                }}
              >
                Query customizada
              </button>
            </div>
          </div>

          {sourceMode === 'simple' ? (
            <>
              {/* Data Source */}
              <div className="space-y-1.5">
                <Label className="text-xs">Data Source</Label>
                <Select
                  value={dataSourceId}
                  onValueChange={(v) => {
                    setDataSourceId(v)
                    setCollection('')
                    setField('')
                    setCollectionSearch('')
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(dataSources ?? []).map((ds) => (
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
                  <Label className="text-xs">Collection</Label>
                  <Select
                    value={collection}
                    onValueChange={(v) => {
                      setCollection(v)
                      setField('')
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Buscar collection..."
                          value={collectionSearch}
                          onChange={(e) => setCollectionSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredCollections.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      {filteredCollections.length === 0 && collectionSearch && (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          Nenhuma collection encontrada
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Label field */}
              {collection && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Coluna de exibição</Label>
                  <p className="text-[10px] text-muted-foreground">
                    O que será mostrado no dropdown do filtro
                  </p>
                  <Select value={field} onValueChange={setField}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.name}{' '}
                          <span className="text-muted-foreground">({f.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </>
          ) : (
            <>
              {/* Query select */}
              <div className="space-y-1.5">
                <Label className="text-xs">Query</Label>
                <div className="flex gap-1">
                  <Select
                    value={selectedQueryId}
                    onValueChange={(v) => {
                      setSelectedQueryId(v)
                      setField('')
                      setQuerySearch('')
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1 text-sm">
                      <span className="flex flex-1 items-center">
                        <GitBranch className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Selecionar query..." />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Buscar query..."
                          value={querySearch}
                          onChange={(e) => setQuerySearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {(queries ?? [])
                        .filter((q) =>
                          querySearch
                            ? q.name.toLowerCase().includes(querySearch.toLowerCase())
                            : true,
                        )
                        .map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.name}
                          </SelectItem>
                        ))}
                      {querySearch && (queries ?? []).filter((q) => q.name.toLowerCase().includes(querySearch.toLowerCase())).length === 0 && (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          Nenhuma query encontrada
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => refetchQueries()}
                    disabled={isFetchingQueries}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingQueries ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <Link
                  to="/questions"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  target="_blank"
                >
                  <ExternalLink className="h-3 w-3" />
                  Criar nova query
                </Link>
              </div>

              {/* Label column from query */}
              {selectedQuery && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Coluna de exibição</Label>
                  <p className="text-[10px] text-muted-foreground">
                    O que será mostrado no dropdown do filtro
                  </p>
                  <Select value={field} onValueChange={(v) => { setField(v); setQueryColumnSearch('') }}>
                    <SelectTrigger className="h-8 text-sm">
                      <span className="flex flex-1 items-center">
                        <Columns2 className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Selecionar coluna..." />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Buscar coluna..."
                          value={queryColumnSearch}
                          onChange={(e) => setQueryColumnSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {queryFields
                        .filter((f) =>
                          queryColumnSearch
                            ? f.name.toLowerCase().includes(queryColumnSearch.toLowerCase())
                            : true,
                        )
                        .map((f) => (
                          <SelectItem key={f.name} value={f.name}>
                            {f.name}{' '}
                            <span className="text-muted-foreground">({f.type})</span>
                          </SelectItem>
                        ))}
                      {queryColumnSearch && queryFields.filter((f) => f.name.toLowerCase().includes(queryColumnSearch.toLowerCase())).length === 0 && (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          Nenhuma coluna encontrada
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </>
          )}

          {/* Filter type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MULTI_SELECT">Multi-select</SelectItem>
                <SelectItem value="SELECT">Select</SelectItem>
                <SelectItem value="TEXT">Texto</SelectItem>
                <SelectItem value="DATE_RANGE">Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Target components */}
          <div className="space-y-2">
            <Label className="text-xs">Componentes alvo</Label>
            <p className="text-xs text-muted-foreground">
              Selecione quais componentes este filtro afeta e o campo correspondente.
            </p>
            {dashboardComponents.map((dc) => {
              const componentName = dc.component?.name ?? 'Componente'
              const mapping = targetMappings[dc.componentId]
              const checked = !!mapping?.enabled
              const tabName = dc.tabId
                ? tabs.find((t) => t.id === dc.tabId)?.name
                : tabs[0]?.name ?? null
              return (
                <div key={dc.id} className="space-y-1 rounded border p-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleComponent(dc.componentId)}
                    />
                    <span className="text-xs font-medium">{componentName}</span>
                    {tabName && (
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tabName}
                      </span>
                    )}
                  </label>
                  {checked && (
                    <>
                      {field && sourceFields.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">
                            Filtro envia:
                          </p>
                          <ValueFieldSelect
                            value={mapping?.valueField ?? ''}
                            onChange={(v) => setComponentValueField(dc.componentId, v)}
                            currentField={field}
                            fields={sourceFields}
                          />
                        </div>
                      )}
                      {field && (
                        <p className="text-[10px] text-muted-foreground">
                          Componente recebe:
                        </p>
                      )}
                      <TargetFieldSelect
                        componentId={dc.componentId}
                        value={mapping?.targetField ?? ''}
                        onChange={(v, fieldType) => setComponentTargetField(dc.componentId, v, fieldType)}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              size="sm"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? 'Salvando...'
                : editingFilter
                  ? 'Atualizar'
                  : 'Criar filtro'}
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>

          {editingFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-1 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir filtro
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ValueFieldSelect({
  value,
  onChange,
  currentField,
  fields,
}: {
  value: string
  onChange: (v: string) => void
  currentField: string
  fields: FieldSchema[]
}) {
  const [search, setSearch] = useState('')

  const available = fields.filter((f) => f.name !== currentField)
  const filtered = search
    ? available.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : available

  return (
    <Select
      value={value || '__same__'}
      onValueChange={(v) => onChange(v === '__same__' ? '' : v)}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <div className="p-1">
          <Input
            className="h-7 text-xs"
            placeholder="Buscar campo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <SelectItem value="__same__">Mesma coluna ({currentField})</SelectItem>
        {filtered.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.name} <span className="text-muted-foreground">({f.type})</span>
          </SelectItem>
        ))}
        {filtered.length === 0 && search && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            Nenhum campo encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

function TargetFieldSelect({
  componentId,
  value,
  onChange,
}: {
  componentId: string
  value: string
  onChange: (v: string, fieldType?: string) => void
}) {
  const [search, setSearch] = useState('')

  const { data: outputData, isLoading, isError } = useQuery<{ fields: MatchableField[] }>({
    queryKey: ['component-matchable-fields', componentId],
    queryFn: () =>
      api.get(`/v1/components/${componentId}/matchable-fields`).then((r) => r.data),
    retry: 1,
  })

  const fields = outputData?.fields ?? []
  const filteredFields = search
    ? fields.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : fields

  // Group fields by origin for visual separation
  const groups = filteredFields.reduce<Record<string, MatchableField[]>>((acc, f) => {
    const key = f.stageLabel ?? f.origin
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (isError) {
    return (
      <div className="space-y-1">
        <Input
          className="h-7 text-xs"
          placeholder="Digite o nome do campo..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Não foi possível carregar campos. Digite manualmente.
        </p>
      </div>
    )
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const fieldType = fields.find((f) => f.name === v)?.type
        onChange(v, fieldType)
      }}
    >
      <SelectTrigger className="h-7 text-xs">
        <SelectValue placeholder="Selecionar campo..." />
      </SelectTrigger>
      <SelectContent>
        <div className="p-1">
          <Input
            className="h-7 text-xs"
            placeholder="Buscar campo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {Object.entries(groups).map(([groupLabel, groupFields]) => (
          <div key={groupLabel}>
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {groupLabel}
            </div>
            {groupFields.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                {f.name} <span className="text-muted-foreground">({f.type})</span>
              </SelectItem>
            ))}
          </div>
        ))}
        {filteredFields.length === 0 && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            Nenhum campo encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
