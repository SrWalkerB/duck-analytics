import { useState } from 'react'
import { X, Link2, ChevronsUpDown, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MatchStage, QueryFilter, FieldSchema } from '@/types'

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-500/10 text-blue-500',
  number: 'bg-amber-500/10 text-amber-500',
  boolean: 'bg-emerald-500/10 text-emerald-500',
  date: 'bg-violet-500/10 text-violet-500',
  objectId: 'bg-orange-500/10 text-orange-500',
  array: 'bg-cyan-500/10 text-cyan-500',
  object: 'bg-pink-500/10 text-pink-500',
  null: 'bg-muted text-muted-foreground',
  mixed: 'bg-muted text-muted-foreground',
}

function operatorsForType(type: string) {
  switch (type) {
    case 'boolean':
      return ['eq', 'ne', 'exists'] as const
    case 'date':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'exists'] as const
    case 'number':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists'] as const
    case 'objectId':
      return ['eq', 'ne', 'in', 'nin', 'exists'] as const
    case 'array':
      return ['in', 'nin', 'exists'] as const
    default:
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex', 'exists'] as const
  }
}

interface Props {
  stage: MatchStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<MatchStage>) => void
}

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
          <span className="truncate">{value || 'Selecione um campo…'}</span>
          <ChevronsUpDown size={10} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
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
                <span
                  className={cn(
                    'rounded px-1 text-[10px]',
                    TYPE_COLORS[fd.type] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {fd.type}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function MatchStageEditor({ stage, fields, onUpdate }: Props) {
  const fieldMap = Object.fromEntries(fields.map((f) => [f.name, f.type]))

  function addFilter() {
    const firstField = fields[0]
    onUpdate({
      filters: [
        ...stage.filters,
        {
          field: firstField?.name ?? '',
          operator: 'eq',
          value: firstField?.type === 'boolean' ? true : '',
        },
      ],
    })
  }

  function updateFilter(i: number, patch: Partial<QueryFilter>) {
    const filters = [...stage.filters]
    if (patch.field && patch.field !== filters[i]?.field) {
      const newType = fieldMap[patch.field] ?? 'string'
      patch.value = newType === 'boolean' ? true : newType === 'number' ? 0 : ''
      const ops = operatorsForType(newType)
      if (!ops.includes(filters[i]?.operator as never)) {
        patch.operator = ops[0] as QueryFilter['operator']
      }
    }
    filters[i] = { ...filters[i]!, ...patch }
    onUpdate({ filters })
  }

  function removeFilter(i: number) {
    onUpdate({ filters: stage.filters.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-2">
      {stage.filters.map((f, i) => {
        const fType = fieldMap[f.field] ?? 'string'
        const ops = operatorsForType(fType)
        return (
          <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center gap-1">
              <FieldCombobox
                value={f.field}
                fields={fields}
                onChange={(v) => updateFilter(i, { field: v })}
              />
              {f.field && (
                <span
                  className={cn(
                    'shrink-0 rounded px-1 text-[10px]',
                    TYPE_COLORS[fType] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {fType}
                </span>
              )}
              <button
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => removeFilter(i)}
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Select
                value={f.operator}
                onValueChange={(v) => updateFilter(i, { operator: v as QueryFilter['operator'] })}
              >
                <SelectTrigger className="h-6 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fType === 'boolean' ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={f.value === true ? 'default' : 'outline'}
                    className="h-6 px-2 text-xs"
                    onClick={() => updateFilter(i, { value: true })}
                  >
                    true
                  </Button>
                  <Button
                    size="sm"
                    variant={f.value === false ? 'default' : 'outline'}
                    className="h-6 px-2 text-xs"
                    onClick={() => updateFilter(i, { value: false })}
                  >
                    false
                  </Button>
                </div>
              ) : fType === 'date' ? (
                <Input
                  type="datetime-local"
                  className="h-6 flex-1 text-xs"
                  value={String(f.value ?? '')}
                  onChange={(e) => updateFilter(i, { value: e.target.value })}
                />
              ) : fType === 'number' ? (
                <Input
                  type="number"
                  className="h-6 flex-1 text-xs"
                  value={String(f.value ?? '')}
                  onChange={(e) =>
                    updateFilter(i, {
                      value: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              ) : (
                <Input
                  className="h-6 flex-1 text-xs"
                  value={String(f.value ?? '')}
                  onChange={(e) => updateFilter(i, { value: e.target.value })}
                  placeholder={
                    f.operator === 'in' || f.operator === 'nin'
                      ? 'val1, val2, ...'
                      : 'valor'
                  }
                />
              )}
            </div>
          </div>
        )
      })}
      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addFilter}>
        + Filtro
      </Button>
    </div>
  )
}
