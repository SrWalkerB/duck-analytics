import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { DataSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/data-sources/')({
  component: DataSourcesPage,
})

function DataSourcesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => api.get('/v1/data-sources').then((r) => r.data),
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/data-sources/${id}/test`),
    onSuccess: () => toast.success('Connection successful'),
    onError: () => toast.error('Connection failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/data-sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] })
      toast.success('Deleted')
    },
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Sources</h1>
        <Link to="/data-sources/new">
          <Button>New Data Source</Button>
        </Link>
      </div>
      {!data?.length && <p className="text-muted-foreground">No data sources yet.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.map((ds) => (
          <Card key={ds.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{ds.name}</CardTitle>
              <Badge>{ds.type}</Badge>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">Database: {ds.database}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testMutation.mutate(ds.id)}>
                  Test
                </Button>
                <Link to="/data-sources/$id" params={{ id: ds.id }}>
                  <Button size="sm" variant="outline">Edit</Button>
                </Link>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(ds.id)}>
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
