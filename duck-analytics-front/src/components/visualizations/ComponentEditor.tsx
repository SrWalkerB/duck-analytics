import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/services/api'
import type { Component, ComponentType, Query } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartRenderer } from './ChartRenderer'
import { toast } from 'sonner'

const COMPONENT_TYPES: ComponentType[] = ['TABLE', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'KPI']

interface Props {
  initialComponent?: Component
}

export function ComponentEditor({ initialComponent }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState(initialComponent?.name ?? '')
  const [type, setType] = useState<ComponentType>(initialComponent?.type ?? 'TABLE')
  const [queryId, setQueryId] = useState(initialComponent?.queryId ?? '')
  const [xField, setXField] = useState((initialComponent?.configuration['xField'] as string) ?? '')
  const [yField, setYField] = useState((initialComponent?.configuration['yField'] as string) ?? '')
  const [label, setLabel] = useState((initialComponent?.configuration['label'] as string) ?? '')
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)

  const { data: queries } = useQuery<Query[]>({
    queryKey: ['queries'],
    queryFn: () => api.get('/v1/queries').then((r) => r.data),
  })

  async function loadPreview() {
    if (!queryId) return
    try {
      const res = await api.post(`/v1/queries/${queryId}/execute`)
      setPreviewData(res.data.data)
    } catch {
      toast.error('Failed to load preview')
    }
  }

  useEffect(() => {
    if (queryId) loadPreview()
  }, [queryId])

  const configuration: Record<string, unknown> = { xField, yField, label }

  const saveMutation = useMutation({
    mutationFn: () =>
      initialComponent
        ? api.put(`/v1/components/${initialComponent.id}`, { name, type, configuration })
        : api.post('/v1/components', { name, type, queryId, configuration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components'] })
      toast.success('Component saved')
      navigate({ to: '/components' })
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Visualization Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ComponentType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPONENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Query</Label>
          <Select value={queryId} onValueChange={setQueryId} disabled={!!initialComponent}>
            <SelectTrigger><SelectValue placeholder="Select query" /></SelectTrigger>
            <SelectContent>
              {queries?.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {type !== 'TABLE' && (
          <>
            <div className="space-y-2">
              <Label>{type === 'KPI' ? 'Value Field' : 'X Axis Field'}</Label>
              <Input value={type === 'KPI' ? yField : xField} onChange={(e) => type === 'KPI' ? setYField(e.target.value) : setXField(e.target.value)} placeholder="field name" />
            </div>
            {type !== 'KPI' && (
              <div className="space-y-2">
                <Label>Y Axis Field</Label>
                <Input value={yField} onChange={(e) => setYField(e.target.value)} placeholder="field name" />
              </div>
            )}
            {type === 'KPI' && (
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            )}
          </>
        )}
        <Button onClick={() => saveMutation.mutate()} disabled={!name || !queryId || saveMutation.isPending}>
          Save
        </Button>
      </div>

      <div>
        <Card className="h-80">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {previewData ? (
              <ChartRenderer type={type} data={previewData} configuration={configuration} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Select a query to preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
