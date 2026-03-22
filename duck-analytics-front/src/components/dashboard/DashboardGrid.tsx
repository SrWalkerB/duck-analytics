import { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Pencil, Trash2, BarChart3 } from 'lucide-react'
import { GridLayout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard, DashboardTab } from '@/types'
import { ComponentCard } from './ComponentCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface LayoutChange {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface PendingMeta {
  title?: string | null
  description?: string | null
}

interface Props {
  dashboard: Dashboard
  data: Record<string, { data: Record<string, unknown>[]; count: number }>
  isEditMode: boolean
  pendingLayout?: Record<string, { x: number; y: number; w: number; h: number }>
  pendingMeta?: Record<string, PendingMeta>
  pendingTabId?: Record<string, string>
  activeTabId: string | null
  tabs: DashboardTab[]
  onLayoutChange?: (layout: LayoutChange[]) => void
  onRemoveComponent?: (dcId: string) => void
  onUpdateMeta?: (dcId: string, meta: PendingMeta) => void
  onMoveToTab?: (dcId: string, tabId: string) => void
  onAddTab?: () => void
  onRenameTab?: (tabId: string, name: string) => void
  onDeleteTab?: (tabId: string) => void
  onSwitchTab?: (tabId: string | null) => void
}

export function DashboardGrid({
  dashboard,
  data,
  isEditMode,
  pendingLayout = {},
  pendingMeta = {},
  pendingTabId = {},
  activeTabId,
  tabs,
  onLayoutChange,
  onRemoveComponent,
  onUpdateMeta,
  onMoveToTab,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  onSwitchTab,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const [renamingTabName, setRenamingTabName] = useState('')

  const effectiveActiveTabId = activeTabId ?? tabs[0]?.id ?? null

  const visibleComponents = dashboard.dashboardComponents.filter((dc) => {
    if (tabs.length === 0) return true
    const effectiveTabId = pendingTabId[dc.id] ?? dc.tabId
    const firstTabId = tabs[0]?.id ?? null
    const componentTab = effectiveTabId ?? firstTabId
    return componentTab === effectiveActiveTabId
  })

  const layout: LayoutItem[] = visibleComponents.map((dc) => {
    const override = pendingLayout[dc.id]
    return {
      i: dc.id,
      x: override?.x ?? dc.x,
      y: override?.y ?? dc.y,
      w: override?.w ?? dc.w,
      h: override?.h ?? dc.h,
      static: !isEditMode,
    }
  })

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      if (!isEditMode || !onLayoutChange) return
      onLayoutChange(
        [...newLayout].map((item) => ({
          id: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      )
    },
    [isEditMode, onLayoutChange],
  )

  function startRename(tab: DashboardTab) {
    setRenamingTabId(tab.id)
    setRenamingTabName(tab.name)
  }

  function commitRename() {
    if (renamingTabId && onRenameTab) {
      onRenameTab(renamingTabId, renamingTabName.trim() || 'Aba')
    }
    setRenamingTabId(null)
  }

  const showTabBar = tabs.length > 0 || isEditMode

  return (
    <div ref={containerRef} className="flex flex-col">
      {showTabBar && (
        <div className="flex items-end border-b">
          {tabs.map((tab) => {
            const isActive = tab.id === effectiveActiveTabId
            return (
              <div
                key={tab.id}
                className={cn(
                  'group relative flex cursor-pointer items-center border-b-2 px-1 pb-2 pt-2 transition-colors',
                  isActive
                    ? 'border-primary'
                    : 'border-transparent',
                )}
                onClick={() => onSwitchTab?.(tab.id)}
              >
                {renamingTabId === tab.id ? (
                  <input
                    autoFocus
                    className="w-24 bg-transparent text-sm font-medium outline-none"
                    value={renamingTabName}
                    onChange={(e) => setRenamingTabName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.name}
                  </span>
                )}

                {/* Chevron — always visible; in edit mode opens dropdown, in view mode just shows */}
                {isEditMode ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="ml-1 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startRename(tab) }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Renomear
                      </DropdownMenuItem>
                      {tabs.length > 1 && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); onDeleteTab?.(tab.id) }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Excluir aba
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            )
          })}

          {isEditMode && (
            <button
              className="mb-2 ml-2 flex items-center text-muted-foreground hover:text-foreground"
              onClick={onAddTab}
              title="Nova aba"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {visibleComponents.length === 0 ? (
        <div className="mt-4 flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          {isEditMode ? (
            <>
              <div className="space-y-1">
                <p className="text-base font-semibold">Esta aba está vazia</p>
                <p className="text-sm text-muted-foreground">
                  Clique em <strong>Adicionar questão</strong> para incluir um gráfico ou tabela.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-base font-semibold">Nenhum componente</p>
              <p className="text-sm text-muted-foreground">
                Este dashboard ainda não possui visualizações.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative mt-4"
          style={
            isEditMode
              ? {
                  backgroundImage:
                    'linear-gradient(to right, rgba(128,128,128,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.12) 1px, transparent 1px)',
                  backgroundSize: `${width / 12}px 60px`,
                }
              : undefined
          }
        >
          <GridLayout
            layout={layout}
            width={width}
            gridConfig={{ cols: 12, rowHeight: 60 }}
            dragConfig={{ enabled: isEditMode, handle: '.drag-handle' }}
            resizeConfig={{ enabled: isEditMode }}
            onLayoutChange={handleLayoutChange}
          >
            {visibleComponents.map((dc) => (
              <div key={dc.id}>
                <ComponentCard
                  dc={dc}
                  componentData={data[dc.id]}
                  isEditMode={isEditMode}
                  tabs={tabs}
                  pendingTitle={pendingMeta[dc.id]?.title}
                  pendingDescription={pendingMeta[dc.id]?.description}
                  onRemove={() => onRemoveComponent?.(dc.id)}
                  onUpdateMeta={(meta) => onUpdateMeta?.(dc.id, meta)}
                  onMoveToTab={(tabId) => onMoveToTab?.(dc.id, tabId)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  )
}
