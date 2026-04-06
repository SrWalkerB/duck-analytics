import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ChevronRight, Folder } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { useFolderTree } from '@/hooks/use-collections'
import type { FolderTreeNode } from '@/types'

function FolderNode({ node }: { node: FolderTreeNode }) {
  const [expanded, setExpanded] = useState(false)
  const params = useParams({ strict: false }) as { folderId?: string }
  const isActive = params.folderId === node.id
  const hasChildren = node.children.length > 0

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={isActive}
        className="justify-between"
      >
        <Link to="/collection/$folderId" params={{ folderId: node.id }}>
          <span className="flex items-center gap-2">
            <Folder className="size-4" />
            <span className="truncate">{node.name}</span>
          </span>
          {hasChildren && (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-sidebar-accent"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              <ChevronRight
                className={`size-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </Link>
      </SidebarMenuSubButton>
      {hasChildren && expanded && (
        <SidebarMenuSub>
          {node.children.map((child) => (
            <FolderNode key={child.id} node={child} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuSubItem>
  )
}

export function FolderTreeSidebar() {
  const { data: tree, isLoading } = useFolderTree()

  if (isLoading || !tree?.length) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuSub>
          {tree.map((node) => (
            <FolderNode key={node.id} node={node} />
          ))}
        </SidebarMenuSub>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
