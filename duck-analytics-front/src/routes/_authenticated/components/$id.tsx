import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Component } from '@/types'
import { ComponentEditor } from '@/components/visualizations/ComponentEditor'

export const Route = createFileRoute('/_authenticated/components/$id')({
  component: EditComponentPage,
})

function EditComponentPage() {
  const { id } = Route.useParams()
  const { data: component } = useQuery<Component>({
    queryKey: ['component', id],
    queryFn: () => api.get(`/v1/components/${id}`).then((r) => r.data),
  })

  if (!component) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit Component: {component.name}</h1>
      <ComponentEditor initialComponent={component} />
    </div>
  )
}
