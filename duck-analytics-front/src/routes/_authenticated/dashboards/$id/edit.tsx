import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Dashboard, Component } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboards/$id/edit')({
  component: DashboardEditPage,
})

function DashboardEditPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', id],
    queryFn: () => api.get(`/v1/dashboards/${id}`).then((r) => r.data),
  })

  const { data: allComponents } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: () => api.get('/v1/components').then((r) => r.data),
  })

  const { data: dashboardData } = useQuery<Record<string, { data: Record<string, unknown>[]; count: number }>>({
    queryKey: ['dashboard-data', id],
    queryFn: () => api.get(`/v1/dashboards/${id}/data`).then((r) => r.data),
    enabled: !!dashboard,
  })

  const addComponent = useMutation({
    mutationFn: (componentId: string) =>
      api.post(`/v1/dashboards/${id}/components`, { componentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', id] })
      qc.invalidateQueries({ queryKey: ['dashboard-data', id] })
      toast.success('Component added')
    },
  })

  const removeComponent = useMutation({
    mutationFn: (dcId: string) => api.delete(`/v1/dashboards/${id}/components/${dcId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', id] })
      toast.success('Component removed')
    },
  })

  const saveLayout = useMutation({
    mutationFn: (layout: { id: string; x: number; y: number; w: number; h: number }[]) =>
      api.put(`/v1/dashboards/${id}/layout`, { layout }),
    onSuccess: () => toast.success('Layout saved'),
  })

  if (isLoading) return <div>Loading...</div>
  if (!dashboard) return <div>Dashboard not found</div>

  const addedIds = new Set(dashboard.dashboardComponents.map((dc) => dc.componentId))
  const availableComponents = allComponents?.filter((c) => !addedIds.has(c.id)) ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit: {dashboard.name}</h1>
        <Button variant="outline" onClick={() => navigate({ to: '/dashboards/$id', params: { id } })}>
          View
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          <DashboardGrid
            dashboard={dashboard}
            data={dashboardData ?? {}}
            readonly={false}
            onLayoutChange={(layout) => saveLayout.mutate(layout)}
            onRemoveComponent={(dcId) => removeComponent.mutate(dcId)}
          />
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Component</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!availableComponents.length && (
                <p className="text-xs text-muted-foreground">No more components to add.</p>
              )}
              {availableComponents.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <Button size="sm" variant="outline" onClick={() => addComponent.mutate(c.id)}>+</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
