import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/data-sources/new')({
  component: NewDataSourcePage,
})

function NewDataSourcePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [connectionString, setConnectionString] = useState('')
  const [database, setDatabase] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/v1/data-sources', { name, connectionString, database, type: 'MONGODB' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-sources'] })
      toast.success('Data source created')
      navigate({ to: '/data-sources' })
    },
    onError: () => toast.error('Failed to create'),
  })

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Data Source</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Connection String</Label>
              <Input value={connectionString} onChange={(e) => setConnectionString(e.target.value)} placeholder="mongodb://..." required />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input value={database} onChange={(e) => setDatabase(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create'}
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
