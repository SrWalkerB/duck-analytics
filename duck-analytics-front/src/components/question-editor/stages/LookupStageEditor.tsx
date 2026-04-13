import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'
import type { LookupStage, FieldSchema } from '@/types'

interface Props {
  stage: LookupStage
  fields: FieldSchema[]
  dataSourceId: string
  collections: string[]
  onUpdate: (patch: Partial<LookupStage>) => void
}

export function LookupStageEditor({
  stage,
  fields,
  dataSourceId,
  collections,
  onUpdate,
}: Props) {
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [localFieldOpen, setLocalFieldOpen] = useState(false)
  const [foreignFieldOpen, setForeignFieldOpen] = useState(false)

  // Fetch schema for foreign collection
  const { data: foreignSchema } = useQuery<{ collection: string; fields: FieldSchema[] }>({
    queryKey: ['collection-schema', dataSourceId, stage.from],
    queryFn: () =>
      api.get(`/v1/data-sources/${dataSourceId}/collections/${stage.from}/schema`).then((r) => r.data),
    enabled: !!dataSourceId && !!stage.from,
  })

  // Store foreign fields on the stage so downstream stages can derive available fields
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])
  useEffect(() => {
    if (foreignSchema?.fields) {
      onUpdateRef.current({ _foreignFields: foreignSchema.fields } as Partial<LookupStage>)
    }
  }, [foreignSchema?.fields])

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Collection (from)</Label>
          <Popover open={collectionOpen} onOpenChange={setCollectionOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex h-6 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs shadow-xs ring-offset-background',
                  'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
                  !stage.from && 'text-muted-foreground',
                )}
              >
                <span className="truncate">{stage.from || 'collection'}</span>
                <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start" sideOffset={4}>
              <Command>
                <CommandInput placeholder="Buscar coleção..." className="text-xs" />
                <CommandList>
                  <CommandEmpty className="py-3 text-xs">Nenhuma coleção encontrada.</CommandEmpty>
                  <CommandGroup>
                    {collections.map((c) => (
                      <CommandItem
                        key={c}
                        value={c}
                        data-checked={stage.from === c}
                        onSelect={(v) => {
                          onUpdate({ from: v })
                          setCollectionOpen(false)
                        }}
                        className="text-xs"
                      >
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Local field</Label>
          <Popover open={localFieldOpen} onOpenChange={setLocalFieldOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex h-6 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs shadow-xs ring-offset-background',
                  'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
                  !stage.localField && 'text-muted-foreground',
                )}
              >
                <span className="truncate">{stage.localField || 'campo'}</span>
                <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start" sideOffset={4}>
              <Command>
                <CommandInput placeholder="Buscar campo..." className="text-xs" />
                <CommandList>
                  <CommandEmpty className="py-3 text-xs">Nenhum campo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {fields.map((f) => (
                      <CommandItem
                        key={f.name}
                        value={f.name}
                        data-checked={stage.localField === f.name}
                        onSelect={(v) => {
                          onUpdate({ localField: v })
                          setLocalFieldOpen(false)
                        }}
                        className="text-xs"
                      >
                        {f.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Foreign field</Label>
          <Popover open={foreignFieldOpen} onOpenChange={setForeignFieldOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex h-6 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs shadow-xs ring-offset-background',
                  'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
                  !stage.foreignField && 'text-muted-foreground',
                )}
              >
                <span className="truncate">{stage.foreignField || '_id'}</span>
                <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start" sideOffset={4}>
              <Command>
                <CommandInput placeholder="Buscar campo..." className="text-xs" />
                <CommandList>
                  <CommandEmpty className="py-3 text-xs">
                    {stage.from ? 'Nenhum campo encontrado.' : 'Selecione a collection'}
                  </CommandEmpty>
                  <CommandGroup>
                    {(foreignSchema?.fields ?? []).map((f) => (
                      <CommandItem
                        key={f.name}
                        value={f.name}
                        data-checked={stage.foreignField === f.name}
                        onSelect={(v) => {
                          onUpdate({ foreignField: v })
                          setForeignFieldOpen(false)
                        }}
                        className="text-xs"
                      >
                        {f.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Output alias</Label>
          <Input
            className="h-6 text-xs"
            value={stage.as || 'joined_data'}
            onChange={(e) => onUpdate({ as: e.target.value })}
            onBlur={() => {
              if (!stage.as.trim()) onUpdate({ as: 'joined_data' })
            }}
            placeholder="joined_data"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <Checkbox
          id={`unwind-${stage.id}`}
          checked={stage.unwind ?? false}
          onCheckedChange={(v) => onUpdate({ unwind: v === true })}
        />
        <label htmlFor={`unwind-${stage.id}`} className="cursor-pointer text-xs text-muted-foreground">
          Flatten array (unwind)
        </label>
      </div>
    </div>
  )
}
