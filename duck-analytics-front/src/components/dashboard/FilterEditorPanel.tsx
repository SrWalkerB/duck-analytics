import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, RefreshCw, ExternalLink } from 'lucide-react'
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
  Component,
  DataSource,
  DashboardFilter,
  DashboardComponent,
  FilterTargetMapping,
  FieldSchema,
  Query,
} from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  dashboardId: string
  dashboardComponents: DashboardComponent[]
  existingFilters: DashboardFilter[]
  editingFilter?: DashboardFilter | null
}

export function FilterEditorPanel({
  open,
  onClose,
  dashboardId,
  dashboardComponents,
  existingFilters,
  editingFilter,
}: Props) {
  const qc = useQueryClient()

  const [label, setLabel] = useState('')
  const [sourceMode, setSourceMode] = useState<'simple' | 'query'>('simple')
  const [dataSourceId, setDataSourceId] = useState('')
  const [collection, setCollection] = useState('')
  const [field, setField] = useState('')
  const [valueField, setValueField] = useState<string>('')
  const [selectedQueryId, setSelectedQueryId] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('MULTI_SELECT')
  const [parentFilterId, setParentFilterId] = useState<string>('')
  const [targetMappings, setTargetMappings] = useState<
    Record<string, { enabled: boolean; targetField: string }>
  >({})

  // Populate form when editing
  useEffect(() => {
    if (editingFilter) {
      setLabel(editingFilter.label)
      setSourceMode(editingFilter.queryId ? 'query' : 'simple')
      setDataSourceId(editingFilter.dataSourceId)
      setCollection(editingFilter.collection)
      setField(editingFilter.field)
      setValueField(editingFilter.valueField ?? '')
      setSelectedQueryId(editingFilter.queryId ?? '')
      setFilterType(editingFilter.type)
      setParentFilterId(editingFilter.parentFilterId ?? '')
      const mappings: Record<string, { enabled: boolean; targetField: string }> = {}
      for (const m of editingFilter.targetMappings) {
        mappings[m.componentId] = { enabled: true, targetField: m.targetField }
      }
      setTargetMappings(mappings)
    } else {
      setLabel('')
      setSourceMode('simple')
      setDataSourceId('')
      setCollection('')
      setField('')
      setValueField('')
      setSelectedQueryId('')
      setFilterType('MULTI_SELECT')
      setParentFilterId('')
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

  // Fetch schema for the selected query's collection (for the "Coluna de valores" field select)
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
          mappings.push({ componentId, targetField: m.targetField.trim() })
        }
      }

      const isQuery = sourceMode === 'query' && selectedQuery
      const payload = {
        label,
        type: filterType,
        field,
        collection: isQuery ? selectedQuery.collection : collection,
        dataSourceId: isQuery ? selectedQuery.dataSourceId : dataSourceId,
        parentFilterId: parentFilterId || undefined,
        targetMappings: mappings,
        valueField: valueField || undefined,
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
  const fields = schemaData?.fields ?? []
  const queryFields = querySchemaData?.fields ?? []
  const canSave =
    sourceMode === 'query'
      ? !!(label.trim() && selectedQueryId && field)
      : !!(label.trim() && dataSourceId && collection && field)
  const availableParents = existingFilters.filter(
    (f) => f.id !== editingFilter?.id,
  )

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

  function setComponentTargetField(componentId: string, targetField: string) {
    setTargetMappings((prev) => ({
      ...prev,
      [componentId]: { ...prev[componentId], enabled: true, targetField },
    }))
  }

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
                  setValueField('')
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
                  setValueField('')
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
                      {collections.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
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

              {/* Value field */}
              {collection && field && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Coluna de valor</Label>
                  <p className="text-[10px] text-muted-foreground">
                    O que será enviado para os componentes (deixe vazio para usar a mesma coluna)
                  </p>
                  <Select
                    value={valueField || '__same__'}
                    onValueChange={(v) => setValueField(v === '__same__' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__same__">Mesma coluna ({field})</SelectItem>
                      {fields
                        .filter((f) => f.name !== field)
                        .map((f) => (
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
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1 text-sm">
                      <SelectValue placeholder="Selecionar query..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(queries ?? []).map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
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
                  <Select value={field} onValueChange={setField}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecionar coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {queryFields.map((f) => (
                        <SelectItem key={f.name} value={f.name}>
                          {f.name}{' '}
                          <span className="text-muted-foreground">({f.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Value column from query */}
              {selectedQuery && field && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Coluna de valor</Label>
                  <p className="text-[10px] text-muted-foreground">
                    O que será enviado para os componentes (deixe vazio para usar a mesma coluna)
                  </p>
                  <Select
                    value={valueField || '__same__'}
                    onValueChange={(v) => setValueField(v === '__same__' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__same__">Mesma coluna ({field})</SelectItem>
                      {queryFields
                        .filter((f) => f.name !== field)
                        .map((f) => (
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

          {/* Parent filter */}
          {availableParents.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Filtro pai (cascata)</Label>
              <Select
                value={parentFilterId || '__none__'}
                onValueChange={(v) =>
                  setParentFilterId(v === '__none__' ? '' : v)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {availableParents.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              return (
                <div key={dc.id} className="space-y-1 rounded border p-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleComponent(dc.componentId)}
                    />
                    <span className="text-xs font-medium">{componentName}</span>
                  </label>
                  {checked && (
                    <>
                      {field && (
                        <p className="text-[10px] text-muted-foreground">
                          Filtro envia: <strong>{valueField || field}</strong> → Componente recebe:
                        </p>
                      )}
                      <TargetFieldSelect
                        componentId={dc.componentId}
                        value={mapping?.targetField ?? ''}
                        onChange={(v) => setComponentTargetField(dc.componentId, v)}
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

function TargetFieldSelect({
  componentId,
  value,
  onChange,
}: {
  componentId: string
  value: string
  onChange: (v: string) => void
}) {
  // Fetch the component to get its query's collection and dataSourceId
  const { data: component } = useQuery<Component & { query?: { collection: string; dataSourceId: string } }>({
    queryKey: ['component', componentId],
    queryFn: () => api.get(`/v1/components/${componentId}`).then((r) => r.data),
  })

  const queryInfo = component?.query
  const { data: schemaData } = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', queryInfo?.dataSourceId, queryInfo?.collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${queryInfo!.dataSourceId}/collections/${queryInfo!.collection}/schema`)
        .then((r) => r.data),
    enabled: !!queryInfo,
  })

  const fields = schemaData?.fields ?? []

  if (!queryInfo) {
    return (
      <Select disabled>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue placeholder="Selecionar campo..." />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.name} <span className="text-muted-foreground">({f.type})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
