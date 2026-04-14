import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Component } from '@/types'
import { useI18n } from '@/i18n/provider'
import { ComponentEditor } from '@/components/visualizations/ComponentEditor'

export const Route = createFileRoute('/_authenticated/components/$id')({
  component: EditComponentPage,
})

function EditComponentPage() {
  const { id } = Route.useParams()
  const { t } = useI18n()
  const { data: component } = useQuery<Component>({
    queryKey: ['component', id],
    queryFn: () => api.get(`/v1/components/${id}`).then((r) => r.data),
  })

  if (!component) return <div>{t('Loading')}...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('Edit Component: {name}', { name: component.name })}</h1>
      <ComponentEditor initialComponent={component} />
    </div>
  )
}
