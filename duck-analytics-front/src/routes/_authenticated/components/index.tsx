import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Component } from '@/types'
import { useI18n } from '@/i18n/provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/components/')({
  component: ComponentsPage,
})

function ComponentsPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: () => api.get('/v1/components').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/components/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['components'] })
      toast.success(t('Deleted'))
    },
  })

  if (isLoading) return <div>{t('Loading')}...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('Components')}</h1>
        <Link to="/components/new">
          <Button>{t('New Component')}</Button>
        </Link>
      </div>
      {!data?.length && <p className="text-muted-foreground">{t('No components yet.')}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{c.name}</CardTitle>
              <Badge variant="outline">{c.type}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Link to="/components/$id" params={{ id: c.id }}>
                  <Button size="sm" variant="outline">{t('Edit')}</Button>
                </Link>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(c.id)}>
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
