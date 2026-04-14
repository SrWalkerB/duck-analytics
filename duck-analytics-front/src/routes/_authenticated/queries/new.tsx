import { createFileRoute } from '@tanstack/react-router'
import { QueryBuilder } from '@/components/query-builder/QueryBuilder'
import { useI18n } from '@/i18n/provider'

export const Route = createFileRoute('/_authenticated/queries/new')({
  component: NewQueryPage,
})

function NewQueryPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('New Query')}</h1>
      <QueryBuilder />
    </div>
  )
}
