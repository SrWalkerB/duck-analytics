import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { CollectionContents, FolderTreeNode } from '@/types'

export function useCollectionContents(folderId: string | null) {
  const endpoint = folderId
    ? `/v1/folders/${folderId}/contents`
    : '/v1/folders/root/contents'

  return useQuery<CollectionContents>({
    queryKey: ['collection-contents', folderId],
    queryFn: () => api.get(endpoint).then((r) => r.data),
  })
}

export function useFolderTree() {
  return useQuery<FolderTreeNode[]>({
    queryKey: ['folder-tree'],
    queryFn: () => api.get('/v1/folders/tree').then((r) => r.data),
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; parentId?: string | null }) =>
      api.post('/v1/folders', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      qc.invalidateQueries({ queryKey: ['folder-tree'] })
    },
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/folders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      qc.invalidateQueries({ queryKey: ['folder-tree'] })
    },
  })
}

export function useMoveItem() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      itemId: string
      itemType: 'folder' | 'dashboard' | 'component'
      targetFolderId: string | null
    }) => {
      if (data.itemType === 'folder') {
        return api.post(`/v1/folders/${data.itemId}/move`, {
          parentId: data.targetFolderId,
        })
      }
      const endpoint =
        data.itemType === 'dashboard'
          ? `/v1/dashboards/${data.itemId}`
          : `/v1/components/${data.itemId}`
      return api.put(endpoint, { folderId: data.targetFolderId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-contents'] })
      qc.invalidateQueries({ queryKey: ['folder-tree'] })
    },
  })
}
