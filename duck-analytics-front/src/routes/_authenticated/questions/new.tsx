import { createFileRoute } from '@tanstack/react-router'
import { QuestionEditor } from '@/components/question-editor/QuestionEditor'

export const Route = createFileRoute('/_authenticated/questions/new')({
  component: NewQuestionPage,
})

function NewQuestionPage() {
  return (
    <div className="-mx-6 -my-6 h-[calc(100vh-3rem)]">
      <QuestionEditor />
    </div>
  )
}
