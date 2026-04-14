import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useI18n } from '@/i18n/provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/dashboards/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: (search.folderId as string) || undefined,
  }),
  component: NewDashboardPage,
})

function NewDashboardPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const qc = useQueryClient()
  const { folderId } = Route.useSearch()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/v1/dashboards', {
        name,
        description: description || undefined,
        folderId: folderId || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['dashboards'] })
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      toast.success(t('Dashboard created'))
      navigate({ to: '/dashboards/$id/edit', params: { id: res.data.id } })
    },
    onError: () => toast.error(t('Failed to create dashboard')),
  })

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t('New Dashboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('Name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t('Description')}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t('Creating...') : t('Create')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/dashboards' })}>
                {t('Cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
