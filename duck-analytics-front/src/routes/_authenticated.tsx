import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { api } from '@/services/api'
import { getStoredToken } from '@/lib/auth-storage'
import { useI18n } from '@/i18n/provider'
import type { User } from '@/types'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const token = getStoredToken()
    if (!token) throw redirect({ to: '/sign-in' })
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { setLocale } = useI18n()
  const { data: currentUser } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/v1/auth/me').then((r) => r.data),
    enabled: Boolean(getStoredToken()),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (currentUser?.locale) setLocale(currentUser.locale)
  }, [currentUser?.locale, setLocale])

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <header className="flex h-12 shrink-0 items-center border-b px-2">
          <SidebarTrigger />
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}
