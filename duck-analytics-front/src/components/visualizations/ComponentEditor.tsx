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
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'

const COMPONENT_TYPES: ComponentType[] = ['TABLE', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'KPI', 'PROGRESS_BAR', 'GAUGE']

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
  const [yFields, setYFields] = useState<string[]>(() => {
    const arr = initialComponent?.configuration['yFields'] as string[] | undefined
    if (arr?.length) return arr
    const single = initialComponent?.configuration['yField'] as string | undefined
    return single ? [single] : ['']
  })
  const [label, setLabel] = useState((initialComponent?.configuration['label'] as string) ?? '')
  const [goalField, setGoalField] = useState((initialComponent?.configuration['goalField'] as string) ?? '')
  const [goalValue, setGoalValue] = useState((initialComponent?.configuration['goalValue'] as number) ?? 0)
  const [goalSource, setGoalSource] = useState<'field' | 'fixed'>(
    (initialComponent?.configuration['goalField'] as string) ? 'field' : 'fixed',
  )
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

  const filteredYFields = yFields.filter(Boolean)
  const configuration: Record<string, unknown> = {
    xField,
    yField: filteredYFields[0] ?? '',
    yFields: filteredYFields,
    label,
    ...((type === 'PROGRESS_BAR' || type === 'GAUGE') && goalSource === 'field' && goalField ? { goalField } : {}),
    ...((type === 'PROGRESS_BAR' || type === 'GAUGE') && goalSource === 'fixed' && goalValue ? { goalValue } : {}),
  }

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
              <Label>{type === 'KPI' || type === 'PROGRESS_BAR' || type === 'GAUGE' ? 'Value Field' : 'X Axis Field'}</Label>
              <Input value={type === 'KPI' || type === 'PROGRESS_BAR' || type === 'GAUGE' ? (yFields[0] ?? '') : xField} onChange={(e) => type === 'KPI' || type === 'PROGRESS_BAR' || type === 'GAUGE' ? setYFields([e.target.value]) : setXField(e.target.value)} placeholder="field name" />
            </div>
            {type !== 'KPI' && type !== 'PROGRESS_BAR' && type !== 'GAUGE' && (
              <div className="space-y-2">
                <Label>Y Axis Fields</Label>
                {yFields.map((field, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={field}
                      onChange={(e) => {
                        const next = [...yFields]; next[idx] = e.target.value; setYFields(next)
                      }}
                      placeholder="field name"
                    />
                    {yFields.length > 1 && (
                      <Button variant="ghost" size="icon"
                        onClick={() => setYFields(yFields.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setYFields([...yFields, ''])}>
                  <Plus className="mr-1 h-3 w-3" /> Add field
                </Button>
              </div>
            )}
            {(type === 'KPI' || type === 'PROGRESS_BAR' || type === 'GAUGE') && (
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            )}
            {(type === 'PROGRESS_BAR' || type === 'GAUGE') && (
              <>
                <div className="space-y-2">
                  <Label>Origem da meta</Label>
                  <Select value={goalSource} onValueChange={(v) => setGoalSource(v as 'field' | 'fixed')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="field">Campo da query</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {goalSource === 'field' ? (
                  <div className="space-y-2">
                    <Label>Campo da meta</Label>
                    <Input value={goalField} onChange={(e) => setGoalField(e.target.value)} placeholder="field name" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Valor da meta</Label>
                    <Input type="number" value={goalValue || ''} onChange={(e) => setGoalValue(Number(e.target.value))} placeholder="ex: 100" />
                  </div>
                )}
              </>
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
