import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Dashboard } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboards/')({
  component: DashboardsPage,
})

function DashboardsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Dashboard[]>({
    queryKey: ['dashboards'],
    queryFn: () => api.get('/v1/dashboards').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/dashboards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboards'] })
      toast.success('Dashboard deleted')
    },
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboards</h1>
        <Link to="/dashboards/new" search={{ folderId: undefined }}>
          <Button>New Dashboard</Button>
        </Link>
      </div>
      {!data?.length && <p className="text-muted-foreground">No dashboards yet.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((d) => (
          <Card key={d.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{d.name}</CardTitle>
              <div className="flex items-center gap-1">
                {d.status === 'PUBLISHED' && (
                  <Badge variant="default" className="text-xs">Publicado</Badge>
                )}
                <Badge variant="outline">{d.dashboardComponents?.length ?? 0} components</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {d.description && <p className="mb-3 text-sm text-muted-foreground">{d.description}</p>}
              <div className="flex gap-2">
                <Link to="/dashboards/$id" params={{ id: d.id }}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
                <Link to="/dashboards/$id/edit" params={{ id: d.id }}>
                  <Button size="sm" variant="outline">Edit</Button>
                </Link>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(d.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
