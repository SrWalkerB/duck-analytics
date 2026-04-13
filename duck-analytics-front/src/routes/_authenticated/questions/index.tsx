import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/questions/')({
  beforeLoad: () => {
    throw redirect({ to: '/collection' })
  },
})
