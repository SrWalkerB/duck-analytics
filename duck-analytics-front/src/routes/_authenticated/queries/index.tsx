import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Query } from '@/types'
import { useI18n } from '@/i18n/provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/queries/')({
  component: QueriesPage,
})

function QueriesPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<(Query & { dataSource: { id: string; name: string } })[]>({
    queryKey: ['queries'],
    queryFn: () => api.get('/v1/queries').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/queries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] })
      toast.success(t('Deleted'))
    },
  })

  if (isLoading) return <div>{t('Loading')}...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('Queries')}</h1>
        <Link to="/queries/new">
          <Button>{t('New Query')}</Button>
        </Link>
      </div>
      {!data?.length && <p className="text-muted-foreground">{t('No queries yet.')}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.map((q) => (
          <Card key={q.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{q.name}</CardTitle>
              <Badge variant="outline">{q.collection}</Badge>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{q.dataSource?.name}</p>
              <div className="flex gap-2">
                <Link to="/queries/$id" params={{ id: q.id }}>
                  <Button size="sm" variant="outline">{t('Edit')}</Button>
                </Link>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(q.id)}>
                  {t('Delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
