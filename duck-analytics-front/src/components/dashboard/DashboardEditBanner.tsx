import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
}

export function DashboardEditBanner({ onCancel, onSave, isSaving }: Props) {
  return (
    <div className="fixed left-0 right-0 top-12 z-50 flex items-center justify-between bg-blue-600 px-4 py-2 text-white shadow-md">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Pencil className="h-4 w-4" />
        Você está editando este painel.
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="bg-white text-blue-700 hover:bg-white/90"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
