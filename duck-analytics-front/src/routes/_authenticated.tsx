import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

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
        <div className="flex h-12 items-center justify-between border-b px-4">
          <SidebarTrigger />
          <div className="relative mx-4 max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              className="pl-8"
              disabled
            />
          </div>
          <ThemeToggle />
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}
