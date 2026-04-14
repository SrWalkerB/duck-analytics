import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Query } from '@/types'
import { useI18n } from '@/i18n/provider'
import { QueryBuilder } from '@/components/query-builder/QueryBuilder'

export const Route = createFileRoute('/_authenticated/queries/$id')({
  component: EditQueryPage,
})

function EditQueryPage() {
  const { id } = Route.useParams()
  const { t } = useI18n()
  const { data: query } = useQuery<Query>({
    queryKey: ['query', id],
    queryFn: () => api.get(`/v1/queries/${id}`).then((r) => r.data),
  })

  if (!query) return <div>{t('Loading')}...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('Edit Query: {name}', { name: query.name })}</h1>
      <QueryBuilder initialQuery={query} />
    </div>
  )
}
