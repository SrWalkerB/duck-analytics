import { useState } from 'react'
import { X, ArrowUp, ArrowDown, ChevronsUpDown, Check, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { SortStage, QuerySort, FieldSchema } from '@/types'

function FieldCombobox({
  value,
  fields,
  onChange,
}: {
  value: string
  fields: FieldSchema[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-6 flex-1 items-center justify-between gap-1 rounded-md border bg-background px-2 text-xs',
            'hover:bg-accent transition-colors',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{value || 'campo…'}</span>
          <ChevronsUpDown size={10} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campo…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              Nenhum campo encontrado
            </CommandEmpty>
            {fields.map((fd) => (
              <CommandItem
                key={fd.name}
                value={fd.name}
                onSelect={(v) => {
                  onChange(v)
                  setOpen(false)
                }}
                className="gap-1.5 text-xs"
              >
                <Check
                  size={11}
                  className={cn('shrink-0', fd.name === value ? 'opacity-100' : 'opacity-0')}
                />
                {fd.name.includes('.') && (
                  <Link2 size={9} className="shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{fd.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface Props {
  stage: SortStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<SortStage>) => void
}

export function SortStageEditor({ stage, fields, onUpdate }: Props) {
  function addSort() {
    onUpdate({
      sort: [...stage.sort, { field: '', direction: 'asc' }],
    })
  }

  function updateSort(i: number, patch: Partial<QuerySort>) {
    const sort = [...stage.sort]
    sort[i] = { ...sort[i]!, ...patch }
    onUpdate({ sort })
  }

  function removeSort(i: number) {
    onUpdate({ sort: stage.sort.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-2">
      {stage.sort.map((s, i) => (
        <div key={i} className="flex items-center gap-1 rounded-md border bg-muted/20 p-1.5">
          <FieldCombobox
            value={s.field}
            fields={fields}
            onChange={(v) => updateSort(i, { field: v })}
          />
          <button
            className="shrink-0 rounded border px-1.5 py-0.5 text-xs hover:bg-muted transition-colors"
            onClick={() =>
              updateSort(i, { direction: s.direction === 'asc' ? 'desc' : 'asc' })
            }
            title={s.direction === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {s.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          </button>
          <button
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => removeSort(i)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addSort}>
        + Ordenação
      </Button>
    </div>
  )
}
