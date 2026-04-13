import { useState } from 'react'
import { Check, ChevronsUpDown, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getDataSourceTerminology } from '@/hooks/use-datasource-terminology'
import type { DataSource } from '@/types'

interface CollectionComboboxProps {
  collections: string[]
  value: string
  onChange: (collection: string) => void
  disabled?: boolean
  isLoading?: boolean
  dataSourceType?: DataSource['type']
}

export function CollectionCombobox({
  collections,
  value,
  onChange,
  disabled,
  isLoading,
  dataSourceType = 'MONGODB',
}: CollectionComboboxProps) {
  const [open, setOpen] = useState(false)
  const terminology = getDataSourceTerminology(dataSourceType)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="h-8 w-full justify-between text-sm font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Database size={12} className="shrink-0 text-muted-foreground" />
            {value || terminology.placeholder}
          </span>
          <ChevronsUpDown size={12} className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={dataSourceType === 'POSTGRESQL' ? 'Buscar tabelas…' : 'Buscar coleções…'} />
          <CommandList>
            <CommandEmpty>
              {isLoading
                ? 'Carregando…'
                : dataSourceType === 'POSTGRESQL'
                  ? 'Nenhuma tabela encontrada'
                  : 'Nenhuma coleção encontrada'}
            </CommandEmpty>
            <CommandGroup>
              {collections.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                  data-checked={value === c}
                >
                  {c}
                  <Check
                    size={12}
                    className={cn('ml-auto', value === c ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
