import { createFileRoute } from '@tanstack/react-router'
import { QuestionEditor } from '@/components/question-editor/QuestionEditor'

export const Route = createFileRoute('/_authenticated/questions/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: (search.folderId as string) || undefined,
  }),
  component: NewQuestionPage,
})

function NewQuestionPage() {
  const { folderId } = Route.useSearch()

  return (
    <div className="-mx-6 -my-6 h-[calc(100vh-3rem)]">
      <QuestionEditor folderId={folderId} />
    </div>
  )
}
