import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const token = localStorage.getItem('token')
    if (!token) throw redirect({ to: '/sign-in' })
    throw redirect({ to: '/dashboards' })
  },
  component: () => null,
})
