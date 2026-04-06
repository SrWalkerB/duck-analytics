import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useCollectionContents, useMoveItem } from '@/hooks/use-collections'
import { CollectionTable } from '@/components/collection/CollectionTable'
import { CollectionBreadcrumbs } from '@/components/collection/CollectionBreadcrumbs'
import { NewItemDropdown } from '@/components/collection/NewItemDropdown'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { CollectionItem } from '@/types'

export const Route = createFileRoute('/_authenticated/collection/$folderId')({
  component: CollectionFolderPage,
})

function CollectionFolderPage() {
  const { folderId } = Route.useParams()
  const { data, isLoading } = useCollectionContents(folderId)
  const qc = useQueryClient()
  const moveItem = useMoveItem()

  const deleteMutation = useMutation({
    mutationFn: (item: CollectionItem) => {
      const endpoint =
        item.type === 'folder'
          ? `/v1/folders/${item.id}`
          : item.type === 'dashboard'
            ? `/v1/dashboards/${item.id}`
            : `/v1/components/${item.id}`
      return api.delete(endpoint)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      qc.invalidateQueries({ queryKey: ['folder-tree'] })
      toast.success('Item excluído')
    },
  })

  function handleDropIntoFolder(draggedItem: CollectionItem, targetFolderId: string) {
    moveItem.mutate(
      {
        itemId: draggedItem.id,
        itemType: draggedItem.type,
        targetFolderId,
      },
      {
        onSuccess: () => toast.success(`"${draggedItem.name}" movido para pasta`),
        onError: () => toast.error('Falha ao mover item'),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const folderName = data?.folder?.name ?? 'Pasta'

  return (
    <div className="space-y-4">
      <CollectionBreadcrumbs breadcrumbs={data?.breadcrumbs ?? []} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{folderName}</h1>
        <NewItemDropdown currentFolderId={folderId} />
      </div>
      <CollectionTable
        items={data?.items ?? []}
        onDelete={(item) => deleteMutation.mutate(item)}
        onDropIntoFolder={handleDropIntoFolder}
      />
    </div>
  )
}
