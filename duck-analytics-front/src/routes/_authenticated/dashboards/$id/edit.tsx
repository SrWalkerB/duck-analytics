import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboards/$id/edit')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/dashboards/$id', params })
  },
  component: () => null,
})
