import { createFileRoute } from '@tanstack/react-router'
import { QueryBuilder } from '@/components/query-builder/QueryBuilder'

export const Route = createFileRoute('/_authenticated/queries/new')({
  component: NewQueryPage,
})

function NewQueryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New Query</h1>
      <QueryBuilder />
    </div>
  )
}
