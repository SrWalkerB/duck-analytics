import { createFileRoute } from '@tanstack/react-router'
import { ComponentEditor } from '@/components/visualizations/ComponentEditor'

export const Route = createFileRoute('/_authenticated/components/new')({
  component: NewComponentPage,
})

function NewComponentPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New Component</h1>
      <ComponentEditor />
    </div>
  )
}
