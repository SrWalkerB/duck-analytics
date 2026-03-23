import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { GripVertical, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { api } from '@/services/api'
import type { Dashboard, DashboardComponent, DashboardFilter, Component, DashboardTab } from '@/types'
import { Button } from '@/components/ui/button'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { DashboardEditBanner } from '@/components/dashboard/DashboardEditBanner'
import { AddQuestionPanel } from '@/components/dashboard/AddQuestionPanel'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { FilterEditorPanel } from '@/components/dashboard/FilterEditorPanel'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export const Route = createFileRoute('/_authenticated/dashboards/$id/')({
  component: DashboardPage,
})

interface PendingMeta {
  title?: string | null
  description?: string | null
}

// Provisional DashboardComponents are stored in toAdd (temp id prefixed with "new:")
interface EditState {
  name: string
  pendingLayout: Record<string, { x: number; y: number; w: number; h: number }>
  pendingMeta: Record<string, PendingMeta>
  pendingTabId: Record<string, string>
  pendingTabs: DashboardTab[]
  // Full provisional objects — merged into the grid so they render immediately
  toAdd: DashboardComponent[]
  toRemove: Set<string>
}

function buildInitialEditState(dashboard: Dashboard): EditState {
  const savedTabs = (dashboard.configuration?.tabs as DashboardTab[] | undefined) ?? []
  // Always ensure at least one tab
  const tabs =
    savedTabs.length > 0
      ? savedTabs
      : [{ id: crypto.randomUUID(), name: 'Guia 1', order: 0 }]
  return {
    name: dashboard.name,
    pendingLayout: {},
    pendingMeta: {},
    pendingTabId: {},
    pendingTabs: tabs,
    toAdd: [],
    toRemove: new Set(),
  }
}

function DashboardPage() {
  const { id } = Route.useParams()
  const qc = useQueryClient()

  const [isEditMode, setIsEditMode] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<DashboardFilter | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown[]>>({})

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', id],
    queryFn: () => api.get(`/v1/dashboards/${id}`).then((r) => r.data),
  })

  const { data: allComponents } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: () => api.get('/v1/components').then((r) => r.data),
    enabled: isEditMode,
  })

  const { data: dashboardData } = useQuery<
    Record<string, { data: Record<string, unknown>[]; count: number }>
  >({
    queryKey: ['dashboard-data', id, activeFilters],
    queryFn: () =>
      api.post(`/v1/dashboards/${id}/data`, { activeFilters }).then((r) => r.data),
    enabled: !!dashboard,
  })

  // Fetch data individually for provisional components added during edit mode
  const provisionalComponents = editState?.toAdd ?? []
  const provisionalDataQueries = useQueries({
    queries: provisionalComponents.map((pdc) => ({
      queryKey: ['component-data', pdc.componentId],
      queryFn: () =>
        api
          .get(`/v1/components/${pdc.componentId}/data`)
          .then((r) => r.data as { data: Record<string, unknown>[]; count: number }),
    })),
  })

  // Merge server dashboard data with provisional component data
  const mergedData: Record<string, { data: Record<string, unknown>[]; count: number }> = {
    ...(dashboardData ?? {}),
  }
  provisionalComponents.forEach((pdc, i) => {
    const result = provisionalDataQueries[i]
    if (result?.data) {
      mergedData[pdc.id] = result.data
    }
  })

  function enterEditMode() {
    if (!dashboard) return
    setEditState(buildInitialEditState(dashboard))
    setActiveTabId(null)
    setIsEditMode(true)
  }

  function cancelEdit() {
    setIsEditMode(false)
    setEditState(null)
    setAddPanelOpen(false)
  }

  async function saveEdit() {
    if (!editState || !dashboard) return
    setIsSaving(true)
    try {
      // 1. Remove components
      for (const dcId of editState.toRemove) {
        await api.delete(`/v1/dashboards/${id}/components/${dcId}`)
      }

      // 2. Add new components (provisional entries)
      for (const pdc of editState.toAdd) {
        const tabId = editState.pendingTabId[pdc.id] ?? pdc.tabId ?? undefined
        await api.post(`/v1/dashboards/${id}/components`, {
          componentId: pdc.componentId,
          tabId,
        })
      }

      // 3. Layout update for existing (non-removed, non-provisional) components
      const existingDcs = dashboard.dashboardComponents.filter(
        (dc) => !editState.toRemove.has(dc.id),
      )
      const layoutPayload = existingDcs.map((dc) => ({
        id: dc.id,
        x: editState.pendingLayout[dc.id]?.x ?? dc.x,
        y: editState.pendingLayout[dc.id]?.y ?? dc.y,
        w: editState.pendingLayout[dc.id]?.w ?? dc.w,
        h: editState.pendingLayout[dc.id]?.h ?? dc.h,
        tabId: editState.pendingTabId[dc.id] ?? dc.tabId ?? undefined,
        title: dc.id in editState.pendingMeta ? editState.pendingMeta[dc.id].title : dc.title,
        description:
          dc.id in editState.pendingMeta
            ? editState.pendingMeta[dc.id].description
            : dc.description,
      }))

      if (layoutPayload.length > 0) {
        await api.put(`/v1/dashboards/${id}/layout`, { layout: layoutPayload })
      }

      // 4. Dashboard name / tabs
      const configUpdate = { ...(dashboard.configuration ?? {}), tabs: editState.pendingTabs }
      if (
        editState.name !== dashboard.name ||
        JSON.stringify(editState.pendingTabs) !== JSON.stringify(dashboard.configuration?.tabs)
      ) {
        await api.put(`/v1/dashboards/${id}`, {
          name: editState.name,
          configuration: configUpdate,
        })
      }

      await qc.invalidateQueries({ queryKey: ['dashboard', id] })
      await qc.invalidateQueries({ queryKey: ['dashboard-data', id] })
      toast.success('Dashboard salvo')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setIsSaving(false)
      setIsEditMode(false)
      setEditState(null)
      setAddPanelOpen(false)
    }
  }

  function handleLayoutChange(
    layout: { id: string; x: number; y: number; w: number; h: number }[],
  ) {
    setEditState((prev) => {
      if (!prev) return prev
      const updated = { ...prev.pendingLayout }
      for (const item of layout) {
        updated[item.id] = { x: item.x, y: item.y, w: item.w, h: item.h }
      }
      return { ...prev, pendingLayout: updated }
    })
  }

  function handleRemoveComponent(dcId: string) {
    setEditState((prev) => {
      if (!prev) return prev
      // If it's a provisional item, just remove from toAdd
      if (dcId.startsWith('new:')) {
        return { ...prev, toAdd: prev.toAdd.filter((dc) => dc.id !== dcId) }
      }
      const toRemove = new Set(prev.toRemove)
      toRemove.add(dcId)
      return { ...prev, toRemove }
    })
  }

  function handleUpdateMeta(dcId: string, meta: PendingMeta) {
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, pendingMeta: { ...prev.pendingMeta, [dcId]: meta } }
    })
  }

  function handleMoveToTab(dcId: string, tabId: string) {
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, pendingTabId: { ...prev.pendingTabId, [dcId]: tabId } }
    })
  }

  function handleAddQuestion(component: Component) {
    const tempId = `new:${crypto.randomUUID()}`
    const provisional: DashboardComponent = {
      id: tempId,
      dashboardId: id,
      componentId: component.id,
      component,
      x: 0,
      y: 9999, // will be pushed to bottom by react-grid-layout
      w: 6,
      h: 4,
      title: null,
      description: null,
      backgroundColor: null,
      tabId: activeTabId,
    }
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, toAdd: [...prev.toAdd, provisional] }
    })
  }

  function handleAddTab() {
    const newTab: DashboardTab = {
      id: crypto.randomUUID(),
      name: 'Nova Aba',
      order: editState?.pendingTabs.length ?? 0,
    }
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, pendingTabs: [...prev.pendingTabs, newTab] }
    })
    setActiveTabId(newTab.id)
  }

  function handleRenameTab(tabId: string, name: string) {
    setEditState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pendingTabs: prev.pendingTabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
      }
    })
  }

  function handleDeleteTab(tabId: string) {
    setEditState((prev) => {
      if (!prev) return prev
      const remaining = prev.pendingTabs.filter((t) => t.id !== tabId)
      const fallbackTabId = remaining[0]?.id
      const updatedTabIds = { ...prev.pendingTabId }
      const allDcs = [...(dashboard?.dashboardComponents ?? []), ...prev.toAdd]
      for (const dc of allDcs) {
        const effective = prev.pendingTabId[dc.id] ?? dc.tabId ?? prev.pendingTabs[0]?.id
        if (effective === tabId && fallbackTabId) {
          updatedTabIds[dc.id] = fallbackTabId
        }
      }
      return { ...prev, pendingTabs: remaining, pendingTabId: updatedTabIds }
    })
    setActiveTabId((prev) => (prev === tabId ? null : prev))
  }

  if (isLoading) return <div>Loading...</div>
  if (!dashboard) return <div>Dashboard not found</div>

  const tabs =
    isEditMode && editState
      ? editState.pendingTabs
      : ((dashboard.configuration?.tabs as DashboardTab[] | undefined) ?? [])

  // Merge server components (minus removals) with provisional additions
  const visibleDashboard: Dashboard =
    isEditMode && editState
      ? {
          ...dashboard,
          dashboardComponents: [
            ...dashboard.dashboardComponents.filter((dc) => !editState.toRemove.has(dc.id)),
            ...editState.toAdd,
          ],
        }
      : dashboard

  return (
    <div className={isEditMode ? 'mt-10' : ''}>
      {isEditMode && editState && (
        <DashboardEditBanner onCancel={cancelEdit} onSave={saveEdit} isSaving={isSaving} />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {isEditMode && editState ? (
            <input
              className="w-full max-w-lg border-b border-border bg-transparent text-2xl font-bold focus:border-primary focus:outline-none"
              value={editState.name}
              onChange={(e) =>
                setEditState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
            />
          ) : (
            <h1 className="text-2xl font-bold">{isEditMode && editState ? editState.name : dashboard.name}</h1>
          )}

          <div className="flex items-center gap-2">
            {isEditMode && editState ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    setEditingFilter(null)
                    setFilterPanelOpen(true)
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Adicionar filtro
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddPanelOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Adicionar questão
                </Button>
              </>
            ) : (
              <Button size="icon" variant="ghost" onClick={enterEditMode} title="Editar dashboard">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {dashboard.description && !isEditMode && (
          <p className="text-muted-foreground">{dashboard.description}</p>
        )}

        {!isEditMode && dashboard.dashboardFilters.length > 0 && (
          <FilterBar
            dashboardId={id}
            filters={dashboard.dashboardFilters}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
          />
        )}

        {isEditMode && dashboard.dashboardFilters.length > 0 && (
          <EditModeFilterBar
            filters={dashboard.dashboardFilters}
            dashboardId={id}
            onEditFilter={(f) => {
              setEditingFilter(f)
              setFilterPanelOpen(true)
            }}
            onReorder={() => qc.invalidateQueries({ queryKey: ['dashboard', id] })}
          />
        )}

        <DashboardGrid
          dashboard={visibleDashboard}
          data={mergedData}
          isEditMode={isEditMode}
          pendingLayout={editState?.pendingLayout}
          pendingMeta={editState?.pendingMeta}
          pendingTabId={editState?.pendingTabId}
          activeTabId={activeTabId}
          tabs={tabs}
          onLayoutChange={handleLayoutChange}
          onRemoveComponent={handleRemoveComponent}
          onUpdateMeta={handleUpdateMeta}
          onMoveToTab={handleMoveToTab}
          onAddTab={handleAddTab}
          onRenameTab={handleRenameTab}
          onDeleteTab={handleDeleteTab}
          onSwitchTab={(tabId) => setActiveTabId(tabId)}
        />
      </div>

      {isEditMode && (
        <>
          <AddQuestionPanel
            open={addPanelOpen}
            onClose={() => setAddPanelOpen(false)}
            components={allComponents ?? []}
            onAdd={handleAddQuestion}
          />
          <FilterEditorPanel
            open={filterPanelOpen}
            onClose={() => {
              setFilterPanelOpen(false)
              setEditingFilter(null)
            }}
            dashboardId={id}
            dashboardComponents={visibleDashboard.dashboardComponents}
            existingFilters={dashboard.dashboardFilters}
            editingFilter={editingFilter}
          />
        </>
      )}
    </div>
  )
}

// ── Drag-and-drop filter bar (edit mode) ──

function EditModeFilterBar({
  filters,
  dashboardId,
  onEditFilter,
  onReorder,
}: {
  filters: DashboardFilter[]
  dashboardId: string
  onEditFilter: (f: DashboardFilter) => void
  onReorder: () => void
}) {
  const [items, setItems] = useState(filters)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Sync with external filters prop
  if (filters.length !== items.length || filters.some((f, i) => f.id !== items[i]?.id)) {
    setItems(filters)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((f) => f.id === active.id)
    const newIndex = items.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)

    try {
      await api.put(`/v1/dashboards/${dashboardId}/filters/reorder`, {
        filterIds: reordered.map((f) => f.id),
      })
      onReorder()
    } catch {
      setItems(items) // rollback
      toast.error('Erro ao reordenar filtros')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
          {items.map((f) => (
            <SortableFilterBadge key={f.id} filter={f} onEdit={() => onEditFilter(f)} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableFilterBadge({
  filter,
  onEdit,
}: {
  filter: DashboardFilter
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Badge
      ref={setNodeRef}
      style={style}
      variant="outline"
      className="cursor-pointer gap-1 px-2 py-1 text-xs hover:bg-accent"
    >
      <GripVertical className="h-3 w-3 cursor-grab text-muted-foreground" {...attributes} {...listeners} />
      <span onClick={onEdit}>{filter.label}</span>
      <Pencil className="h-3 w-3 cursor-pointer" onClick={onEdit} />
    </Badge>
  )
}
