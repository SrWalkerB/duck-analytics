import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { api } from '@/services/api'
import { useCollectionContents, useMoveItem } from '@/hooks/use-collections'
import { CollectionTable } from '@/components/collection/CollectionTable'
import { CollectionBreadcrumbs } from '@/components/collection/CollectionBreadcrumbs'
import { NewItemDropdown } from '@/components/collection/NewItemDropdown'
import { Input } from '@/components/ui/input'
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
  const [isEditingName, setIsEditingName] = useState(false)
  const [folderNameDraft, setFolderNameDraft] = useState('')

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

  const updateFolderName = useMutation({
    mutationFn: (name: string) => api.put(`/v1/folders/${folderId}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      qc.invalidateQueries({ queryKey: ['folder-tree'] })
      toast.success('Pasta renomeada')
    },
    onError: () => {
      toast.error('Falha ao renomear pasta')
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

  const folderName = data?.folder?.name ?? 'Pasta'

  useEffect(() => {
    setFolderNameDraft(folderName)
  }, [folderName])

  function startFolderRename() {
    setFolderNameDraft(folderName)
    setIsEditingName(true)
  }

  function cancelFolderRename() {
    setFolderNameDraft(folderName)
    setIsEditingName(false)
  }

  function commitFolderRename() {
    const nextName = folderNameDraft.trim()
    if (!nextName) {
      setFolderNameDraft(folderName)
      setIsEditingName(false)
      return
    }

    if (nextName === folderName) {
      setIsEditingName(false)
      return
    }

    updateFolderName.mutate(nextName)
    setIsEditingName(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CollectionBreadcrumbs breadcrumbs={data?.breadcrumbs ?? []} />
      <div className="flex items-center justify-between">
        {isEditingName ? (
          <Input
            autoFocus
            value={folderNameDraft}
            onChange={(e) => setFolderNameDraft(e.target.value)}
            onBlur={commitFolderRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitFolderRename()
              if (e.key === 'Escape') cancelFolderRename()
            }}
            disabled={updateFolderName.isPending}
            className="h-10 max-w-md text-2xl font-bold"
          />
        ) : (
          <button
            type="button"
            className="group inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-2xl font-bold transition-colors hover:cursor-text hover:border-border/80 hover:bg-muted/50"
            onClick={startFolderRename}
            title="Clique para renomear a pasta"
          >
            <span>{folderName}</span>
            <Pencil className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
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
