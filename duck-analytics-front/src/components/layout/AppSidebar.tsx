import { Link, useNavigate } from '@tanstack/react-router'
import { Blocks, Database, LayoutDashboard, LogOut, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'

const navItems = [
  { label: 'Dashboards', to: '/dashboards', icon: LayoutDashboard },
  { label: 'Components', to: '/questions', icon: Blocks },
  { label: 'Data Sources', to: '/data-sources', icon: Database },
]

export function AppSidebar() {
  const navigate = useNavigate()

  function handleSignOut() {
    localStorage.removeItem('token')
    navigate({ to: '/sign-in' })
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-3">
          <span className="text-lg font-semibold">Duck Analytics</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings">
                    <Settings className="size-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
