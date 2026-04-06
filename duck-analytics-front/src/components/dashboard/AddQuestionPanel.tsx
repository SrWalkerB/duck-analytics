import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Component } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  TABLE: 'Tabela',
  BAR_CHART: 'Barras',
  LINE_CHART: 'Linha',
  PIE_CHART: 'Pizza',
  KPI: 'KPI',
}

interface Props {
  open: boolean
  onClose: () => void
  components: Component[]
  usageCountByComponentId: Record<string, number>
  onAdd: (component: Component) => void
}

export function AddQuestionPanel({
  open,
  onClose,
  components,
  usageCountByComponentId,
  onAdd,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 p-0" aria-describedby={undefined}>
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Adicionar componente</SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 text-sm"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          {filtered.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Nenhum componente encontrado.</p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {usageCountByComponentId[c.id] ?? 0} no dashboard
                  </span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="ml-2 h-7 w-7 shrink-0"
                onClick={() => onAdd(c)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
