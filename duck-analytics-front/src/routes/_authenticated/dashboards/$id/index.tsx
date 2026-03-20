import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Dashboard } from '@/types'
import { Button } from '@/components/ui/button'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'

export const Route = createFileRoute('/_authenticated/dashboards/$id/')({
  component: DashboardViewPage,
})

function DashboardViewPage() {
  const { id } = Route.useParams()
  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', id],
    queryFn: () => api.get(`/v1/dashboards/${id}`).then((r) => r.data),
  })

  const { data: dashboardData } = useQuery<Record<string, { data: Record<string, unknown>[]; count: number }>>({
    queryKey: ['dashboard-data', id],
    queryFn: () => api.get(`/v1/dashboards/${id}/data`).then((r) => r.data),
    enabled: !!dashboard,
  })

  if (isLoading) return <div>Loading...</div>
  if (!dashboard) return <div>Dashboard not found</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{dashboard.name}</h1>
        <Link to="/dashboards/$id/edit" params={{ id }}>
          <Button variant="outline">Edit</Button>
        </Link>
      </div>
      {dashboard.description && <p className="text-muted-foreground">{dashboard.description}</p>}
      <DashboardGrid
        dashboard={dashboard}
        data={dashboardData ?? {}}
        readonly
      />
    </div>
  )
}
