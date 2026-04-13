import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const token = localStorage.getItem('token')
    if (!token) throw redirect({ to: '/sign-in' })
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
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
