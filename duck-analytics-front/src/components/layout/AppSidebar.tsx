import { Link, useNavigate } from '@tanstack/react-router'
import { Database, FolderOpen, LogOut, ScrollText, Settings } from 'lucide-react'
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
import { FolderTreeSidebar } from '@/components/collection/FolderTreeSidebar'
import { clearStoredAuth } from '@/lib/auth-storage'
import { useI18n } from '@/i18n/provider'

export function AppSidebar() {
  const navigate = useNavigate()
  const { t } = useI18n()

  function handleSignOut() {
    clearStoredAuth()
    navigate({ to: '/sign-in' })
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-3">
          <span className="text-lg font-semibold">{t('Duck Analytics')}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('Collections')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/collection">
                    <FolderOpen className="size-4" />
                    <span>{t('All collections')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <FolderTreeSidebar />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t('Configuration')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/data-sources">
                    <Database className="size-4" />
                    <span>{t('Data Sources')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/logs">
                    <ScrollText className="size-4" />
                    <span>{t('Logs')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/settings">
                    <Settings className="size-4" />
                    <span>{t('Settings')}</span>
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
          <span>{t('Sign Out')}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
