import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Component, Query } from '@/types'
import { QuestionEditor } from '@/components/question-editor/QuestionEditor'

export const Route = createFileRoute('/_authenticated/questions/$id')({
  component: EditQuestionPage,
})

function EditQuestionPage() {
  const { id } = Route.useParams()

  const { data: component, isLoading: loadingComponent } = useQuery<Component>({
    queryKey: ['component', id],
    queryFn: () => api.get(`/v1/components/${id}`).then((r) => r.data),
  })

  const { data: query, isLoading: loadingQuery } = useQuery<Query>({
    queryKey: ['query', component?.queryId],
    queryFn: () => api.get(`/v1/queries/${component!.queryId}`).then((r) => r.data),
    enabled: !!component?.queryId,
  })

  if (loadingComponent || loadingQuery) {
    return (
      <div className="-mx-6 -my-6 flex h-[calc(100vh-3rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!component || !query) {
    return (
      <div className="-mx-6 -my-6 flex h-[calc(100vh-3rem)] items-center justify-center text-sm text-muted-foreground">
        Question not found
      </div>
    )
  }

  return (
    <div className="-mx-6 -my-6 h-[calc(100vh-3rem)]">
      <QuestionEditor initialQuery={query} initialComponent={component} />
    </div>
  )
}
