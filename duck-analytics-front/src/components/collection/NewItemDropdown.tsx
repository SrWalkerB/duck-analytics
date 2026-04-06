import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, FolderPlus, LayoutDashboard, Blocks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateFolder } from '@/hooks/use-collections'
import { toast } from 'sonner'

interface NewItemDropdownProps {
  currentFolderId: string | null
}

export function NewItemDropdown({ currentFolderId }: NewItemDropdownProps) {
  const navigate = useNavigate()
  const createFolder = useCreateFolder()
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState('')

  function handleCreateFolder() {
    if (!folderName.trim()) return
    createFolder.mutate(
      { name: folderName.trim(), parentId: currentFolderId },
      {
        onSuccess: () => {
          toast.success('Pasta criada')
          setShowFolderDialog(false)
          setFolderName('')
        },
      },
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="mr-2 size-4" />
            Novo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowFolderDialog(true)}>
            <FolderPlus className="mr-2 size-4" />
            Nova Pasta
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/dashboards/new',
                search: { folderId: currentFolderId ?? undefined },
              })
            }
          >
            <LayoutDashboard className="mr-2 size-4" />
            Novo Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/questions/new',
                search: { folderId: currentFolderId ?? undefined },
              })
            }
          >
            <Blocks className="mr-2 size-4" />
            Novo Componente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Nome da pasta"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
