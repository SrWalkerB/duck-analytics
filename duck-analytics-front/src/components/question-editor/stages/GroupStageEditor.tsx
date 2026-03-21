import { useState } from 'react'
import { X, Link2, ChevronsUpDown, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import type { GroupStage, QueryAggregation, FieldSchema } from '@/types'

const AGGREGATION_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT'] as const

function FieldCombobox({
  value,
  fields,
  placeholder = 'Selecione um campo…',
  onChange,
}: {
  value: string
  fields: FieldSchema[]
  placeholder?: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex h-6 w-full items-center justify-between gap-1 rounded-md border bg-background px-2 text-xs',
            'hover:bg-accent transition-colors',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{value || placeholder}</span>
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
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface Props {
  stage: GroupStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<GroupStage>) => void
}

export function GroupStageEditor({ stage, fields, onUpdate }: Props) {
  function addGroupByField(field: string) {
    if (stage.groupBy.includes(field)) return
    onUpdate({ groupBy: [...stage.groupBy, field] })
  }

  function removeGroupByField(field: string) {
    onUpdate({ groupBy: stage.groupBy.filter((f) => f !== field) })
  }

  function addAgg() {
    onUpdate({
      aggregations: [
        ...stage.aggregations,
        { function: 'COUNT', field: fields[0]?.name ?? '', alias: '' },
      ],
    })
  }

  function updateAgg(i: number, patch: Partial<QueryAggregation>) {
    const aggs = [...stage.aggregations]
    aggs[i] = { ...aggs[i]!, ...patch }
    onUpdate({ aggregations: aggs })
  }

  function removeAgg(i: number) {
    onUpdate({ aggregations: stage.aggregations.filter((_, idx) => idx !== i) })
  }

  const availableGroupByFields = fields.filter((f) => !stage.groupBy.includes(f.name))

  return (
    <div className="space-y-3">
      {/* Group By */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Group By</Label>
        {stage.groupBy.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stage.groupBy.map((field) => (
              <Badge key={field} variant="secondary" className="gap-1 text-xs">
                {field}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeGroupByField(field)}
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {availableGroupByFields.length > 0 && (
          <FieldCombobox
            value=""
            fields={availableGroupByFields}
            placeholder="+ campo"
            onChange={addGroupByField}
          />
        )}
      </div>

      {/* Aggregations */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Métricas</Label>
        {stage.aggregations.map((agg, i) => (
          <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center gap-1">
              <Select
                value={agg.function}
                onValueChange={(v) =>
                  updateAgg(i, { function: v as QueryAggregation['function'] })
                }
              >
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn} value={fn}>
                      {fn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => removeAgg(i)}
              >
                <X size={12} />
              </button>
            </div>
            <FieldCombobox
              value={agg.field}
              fields={fields}
              placeholder="campo"
              onChange={(v) => updateAgg(i, { field: v })}
            />
            <Input
              className="h-6 text-xs"
              placeholder="alias (ex: total)"
              value={agg.alias}
              onChange={(e) => updateAgg(i, { alias: e.target.value })}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addAgg}>
          + Métrica
        </Button>
      </div>
    </div>
  )
}
