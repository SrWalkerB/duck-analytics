import { createFileRoute } from '@tanstack/react-router'
import { ComponentEditor } from '@/components/visualizations/ComponentEditor'
import { useI18n } from '@/i18n/provider'

export const Route = createFileRoute('/_authenticated/components/new')({
  component: NewComponentPage,
})

function NewComponentPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('New Component')}</h1>
      <ComponentEditor />
    </div>
  )
}
