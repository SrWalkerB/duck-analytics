import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  Folder,
  LayoutDashboard,
  Table2,
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  MoreHorizontal,
  Trash2,
  FolderInput,
  GripVertical,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { CollectionItem, ComponentType } from '@/types'

const componentTypeIcons: Record<ComponentType, React.ElementType> = {
  TABLE: Table2,
  BAR_CHART: BarChart3,
  LINE_CHART: LineChart,
  PIE_CHART: PieChart,
  KPI: Gauge,
}

function getItemIcon(item: CollectionItem) {
  if (item.type === 'folder') return Folder
  if (item.type === 'dashboard') return LayoutDashboard
  if (item.itemType) return componentTypeIcons[item.itemType] ?? Table2
  return Table2
}

function getItemLink(item: CollectionItem): { to: string; params?: Record<string, string> } {
  if (item.type === 'folder') return { to: '/collection/$folderId', params: { folderId: item.id } }
  if (item.type === 'dashboard') return { to: '/dashboards/$id', params: { id: item.id } }
  return { to: '/questions/$id', params: { id: item.id } }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

// ── Draggable Row ──

function DraggableRow({
  item,
  isOverlay,
  onDelete,
  onMove,
}: {
  item: CollectionItem
  isOverlay?: boolean
  onDelete?: (item: CollectionItem) => void
  onMove?: (item: CollectionItem) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${item.type}-${item.id}`,
    data: item,
  })

  const Icon = getItemIcon(item)
  const link = getItemLink(item)

  return (
    <TableRow
      ref={setNodeRef}
      className={isDragging && !isOverlay ? 'opacity-30' : undefined}
    >
      <TableCell className="w-8">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="w-10">
        <Icon className="size-4 text-muted-foreground" />
      </TableCell>
      <TableCell>
        {isOverlay ? (
          <span className="font-medium">{item.name}</span>
        ) : (
          <Link
            to={link.to}
            params={link.params}
            className="font-medium hover:underline"
          >
            {item.name}
          </Link>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(item.updatedAt)}
      </TableCell>
      <TableCell>
        {!isOverlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMove && (
                <DropdownMenuItem onClick={() => onMove(item)}>
                  <FolderInput className="mr-2 size-4" />
                  Mover
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Droppable Folder Row ──

function DroppableFolderRow({
  item,
  onDelete,
  onMove,
}: {
  item: CollectionItem
  onDelete?: (item: CollectionItem) => void
  onMove?: (item: CollectionItem) => void
}) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-${item.id}`,
    data: { folderId: item.id },
  })

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `${item.type}-${item.id}`,
    data: item,
  })

  const Icon = getItemIcon(item)
  const link = getItemLink(item)

  return (
    <TableRow
      ref={(node) => {
        setDropRef(node)
        setDragRef(node)
      }}
      className={
        isOver
          ? 'ring-2 ring-primary ring-inset bg-primary/10'
          : isDragging
            ? 'opacity-30'
            : undefined
      }
    >
      <TableCell className="w-8">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="w-10">
        <Icon className="size-4 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <Link
          to={link.to}
          params={link.params}
          className="font-medium hover:underline"
        >
          {item.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(item.updatedAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onMove && (
              <DropdownMenuItem onClick={() => onMove(item)}>
                <FolderInput className="mr-2 size-4" />
                Mover
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="mr-2 size-4" />
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

// ── Main Table ──

interface CollectionTableProps {
  items: CollectionItem[]
  onDelete?: (item: CollectionItem) => void
  onMove?: (item: CollectionItem) => void
  onDropIntoFolder?: (draggedItem: CollectionItem, targetFolderId: string) => void
}

export function CollectionTable({ items, onDelete, onMove, onDropIntoFolder }: CollectionTableProps) {
  const [activeItem, setActiveItem] = useState<CollectionItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active.data.current as CollectionItem)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)

    if (!over || !onDropIntoFolder) return

    const draggedItem = active.data.current as CollectionItem
    const dropData = over.data.current as { folderId?: string } | undefined

    if (dropData?.folderId && draggedItem.id !== dropData.folderId) {
      onDropIntoFolder(draggedItem, dropData.folderId)
    }
  }

  if (!items.length) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Esta coleção está vazia.
      </p>
    )
  }

  const folderItems = items.filter((i) => i.type === 'folder')
  const nonFolderItems = items.filter((i) => i.type !== 'folder')
  const sortedItems = [...folderItems, ...nonFolderItems]

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-10">Tipo</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-40">Última edição</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) =>
            item.type === 'folder' ? (
              <DroppableFolderRow
                key={`${item.type}-${item.id}`}
                item={item}
                onDelete={onDelete}
                onMove={onMove}
              />
            ) : (
              <DraggableRow
                key={`${item.type}-${item.id}`}
                item={item}
                onDelete={onDelete}
                onMove={onMove}
              />
            ),
          )}
        </TableBody>
      </Table>

      <DragOverlay>
        {activeItem && (
          <div className="rounded-md border bg-background shadow-lg">
            <Table>
              <TableBody>
                <DraggableRow item={activeItem} isOverlay />
              </TableBody>
            </Table>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
