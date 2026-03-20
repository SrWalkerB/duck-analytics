import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/services/api'
import type { DataSource, FieldSchema, QueryConfiguration, QueryFilter, QueryAggregation, Query } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Props {
  initialQuery?: Query
}

const AGGREGATION_FUNCTIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const
const FILTER_OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex', 'exists'] as const

export function QueryBuilder({ initialQuery }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState(initialQuery?.name ?? '')
  const [dataSourceId, setDataSourceId] = useState(initialQuery?.dataSourceId ?? '')
  const [collection, setCollection] = useState(initialQuery?.collection ?? '')
  const [configuration, setConfiguration] = useState<QueryConfiguration>(
    (initialQuery?.configuration as QueryConfiguration) ?? {}
  )
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => api.get('/v1/data-sources').then((r) => r.data),
  })

  const { data: collections } = useQuery<{ collections: string[] }>({
    queryKey: ['ds-collections', dataSourceId],
    queryFn: () => api.get(`/v1/data-sources/${dataSourceId}/collections`).then((r) => r.data),
    enabled: !!dataSourceId,
  })

  const { data: schema } = useQuery<{ collection: string; fields: FieldSchema[] }>({
    queryKey: ['collection-schema', dataSourceId, collection],
    queryFn: () => api.get(`/v1/data-sources/${dataSourceId}/collections/${collection}/schema`).then((r) => r.data),
    enabled: !!dataSourceId && !!collection,
  })

  const previewMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/queries/preview', { dataSourceId, collection, configuration }),
    onSuccess: (res) => {
      setPreviewData(res.data.data)
      toast.success(`${res.data.count} rows`)
    },
    onError: () => toast.error('Preview failed'),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      initialQuery
        ? api.put(`/v1/queries/${initialQuery.id}`, { name, configuration })
        : api.post('/v1/queries', { name, dataSourceId, collection, configuration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] })
      toast.success('Query saved')
      navigate({ to: '/queries' })
    },
    onError: () => toast.error('Failed to save'),
  })

  const fields = schema?.fields ?? []

  function addFilter() {
    setConfiguration((c) => ({
      ...c,
      filters: [...(c.filters ?? []), { field: fields[0]?.name ?? '', operator: 'eq', value: '' }],
    }))
  }

  function updateFilter(i: number, patch: Partial<QueryFilter>) {
    setConfiguration((c) => {
      const filters = [...(c.filters ?? [])]
      filters[i] = { ...filters[i]!, ...patch }
      return { ...c, filters }
    })
  }

  function removeFilter(i: number) {
    setConfiguration((c) => ({ ...c, filters: c.filters?.filter((_, j) => j !== i) }))
  }

  function addAggregation() {
    setConfiguration((c) => ({
      ...c,
      aggregations: [...(c.aggregations ?? []), { field: fields[0]?.name ?? '', function: 'COUNT', alias: 'count' }],
    }))
  }

  function updateAgg(i: number, patch: Partial<QueryAggregation>) {
    setConfiguration((c) => {
      const aggs = [...(c.aggregations ?? [])]
      aggs[i] = { ...aggs[i]!, ...patch }
      return { ...c, aggregations: aggs }
    })
  }

  function removeAgg(i: number) {
    setConfiguration((c) => ({ ...c, aggregations: c.aggregations?.filter((_, j) => j !== i) }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Query Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Data Source</Label>
          <Select value={dataSourceId} onValueChange={setDataSourceId} disabled={!!initialQuery}>
            <SelectTrigger>
              <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              {dataSources?.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {dataSourceId && (
          <div className="space-y-2">
            <Label>Collection</Label>
            <Select value={collection} onValueChange={setCollection} disabled={!!initialQuery}>
              <SelectTrigger>
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                {collections?.collections.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {collection && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Filters</CardTitle>
              <Button size="sm" variant="outline" onClick={addFilter}>+ Add Filter</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(configuration.filters ?? []).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={f.field} onValueChange={(v) => updateFilter(i, { field: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fields.map((fd) => <SelectItem key={fd.name} value={fd.name}>{fd.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={f.operator} onValueChange={(v) => updateFilter(i, { operator: v as QueryFilter['operator'] })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="flex-1" value={String(f.value ?? '')} onChange={(e) => updateFilter(i, { value: e.target.value })} />
                  <Button size="sm" variant="ghost" onClick={() => removeFilter(i)}>×</Button>
                </div>
              ))}
              {!configuration.filters?.length && <p className="text-xs text-muted-foreground">No filters</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Aggregations</CardTitle>
              <Button size="sm" variant="outline" onClick={addAggregation}>+ Add</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(configuration.aggregations ?? []).map((agg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={agg.function} onValueChange={(v) => updateAgg(i, { function: v as QueryAggregation['function'] })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGGREGATION_FUNCTIONS.map((fn) => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={agg.field} onValueChange={(v) => updateAgg(i, { field: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fields.map((fd) => <SelectItem key={fd.name} value={fd.name}>{fd.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="alias" className="w-24" value={agg.alias} onChange={(e) => updateAgg(i, { alias: e.target.value })} />
                  <Button size="sm" variant="ghost" onClick={() => removeAgg(i)}>×</Button>
                </div>
              ))}
              {!configuration.aggregations?.length && <p className="text-xs text-muted-foreground">No aggregations - raw rows returned</p>}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Limit</Label>
            <Input
              type="number"
              className="w-32"
              value={configuration.limit ?? 1000}
              onChange={(e) => setConfiguration((c) => ({ ...c, limit: parseInt(e.target.value) || 1000 }))}
            />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => previewMutation.mutate()}
          disabled={!dataSourceId || !collection || previewMutation.isPending}
        >
          Preview
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!name || !dataSourceId || !collection || saveMutation.isPending}
        >
          Save
        </Button>
      </div>

      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview ({previewData.length} rows)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            {previewData.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]!).slice(0, 10).map((k) => (
                      <th key={k} className="border px-2 py-1 text-left">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      {Object.keys(previewData[0]!).slice(0, 10).map((k) => (
                        <td key={k} className="border px-2 py-1">{String(row[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!previewData.length && <p className="text-muted-foreground">No results</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
