import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import type { DataSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/data-sources/$id')({
  component: EditDataSourcePage,
})

function EditDataSourcePage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [database, setDatabase] = useState('')

  const { data: ds } = useQuery<DataSource>({
    queryKey: ['data-source', id],
    queryFn: () => api.get(`/v1/data-sources/${id}`).then((r) => r.data),
  })

  useEffect(() => {
    if (ds) { setName(ds.name); setDatabase(ds.database) }
  }, [ds])

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/v1/data-sources/${id}`, { name, database }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] })
      toast.success('Updated')
      navigate({ to: '/data-sources' })
    },
  })

  const testMutation = useMutation({
    mutationFn: () => api.post(`/v1/data-sources/${id}/test`),
    onSuccess: () => toast.success('Connection successful'),
    onError: () => toast.error('Connection failed'),
  })

  if (!ds) return <div>Loading...</div>

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Edit Data Source</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input value={database} onChange={(e) => setDatabase(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending}>Save</Button>
              <Button type="button" variant="outline" onClick={() => testMutation.mutate()}>
                Test Connection
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/data-sources' })}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
