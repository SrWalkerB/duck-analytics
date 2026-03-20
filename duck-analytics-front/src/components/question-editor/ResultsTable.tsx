import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Settings2 } from 'lucide-react'
import { flattenRows } from '@/lib/flatten-row'
import type { QuerySort } from '@/types'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ResultsTableProps {
  data: Record<string, unknown>[]
  visibleColumns?: string[]
  onVisibleColumnsChange?: (cols: string[]) => void
  sort?: QuerySort[]
  onSortToggle?: (field: string) => void
}

function formatCell(value: unknown): { text: string; type: 'null' | 'number' | 'boolean' | 'date' | 'text' } {
  if (value === null || value === undefined) return { text: '—', type: 'null' }
  if (typeof value === 'boolean') return { text: String(value), type: 'boolean' }
  if (typeof value === 'number') return { text: value.toLocaleString(), type: 'number' }
  if (typeof value === 'string') {
    // ISO date detection
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      try {
        const d = new Date(value)
        return { text: d.toLocaleString(), type: 'date' }
      } catch {
        // fall through
      }
    }
    return { text: value, type: 'text' }
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    return { text: json.length > 80 ? json.slice(0, 80) + '…' : json, type: 'text' }
  }
  return { text: String(value), type: 'text' }
}

export function ResultsTable({
  data,
  visibleColumns,
  onVisibleColumnsChange,
  sort,
  onSortToggle,
}: ResultsTableProps) {
  const flatData = useMemo(() => flattenRows(data), [data])

  const allColumns = useMemo(() => {
    if (flatData.length === 0) return []
    const cols = new Set<string>()
    for (const row of flatData.slice(0, 50)) {
      for (const key of Object.keys(row)) {
        cols.add(key)
      }
    }
    return Array.from(cols)
  }, [flatData])

  // Local visible columns state (default: all except _id)
  const [localVisible, setLocalVisible] = useState<string[] | null>(null)
  const effectiveVisible = visibleColumns ?? localVisible ?? allColumns.filter((c) => c !== '_id')

  function toggleColumn(col: string) {
    const current = effectiveVisible
    const next = current.includes(col) ? current.filter((c) => c !== col) : [...current, col]
    if (onVisibleColumnsChange) onVisibleColumnsChange(next)
    else setLocalVisible(next)
  }

  function getSortIcon(field: string) {
    const entry = sort?.find((s) => s.field === field)
    if (!entry) return <ArrowUpDown size={12} className="opacity-30" />
    if (entry.direction === 'asc') return <ArrowUp size={12} className="text-primary" />
    return <ArrowDown size={12} className="text-primary" />
  }

  const displayCols = effectiveVisible.filter((c) => allColumns.includes(c))
  const rows = flatData.slice(0, 200)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {rows.length} / {flatData.length} linhas · {displayCols.length} colunas
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs">
              <Settings2 size={12} />
              Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
            {allColumns.map((col) => (
              <div
                key={col}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                onClick={() => toggleColumn(col)}
              >
                <Checkbox
                  checked={effectiveVisible.includes(col)}
                  onCheckedChange={() => toggleColumn(col)}
                  className="size-3.5"
                />
                <span className="truncate">{col}</span>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {displayCols.map((col) => (
                <TableHead
                  key={col}
                  className={cn(
                    'whitespace-nowrap text-xs',
                    onSortToggle && 'cursor-pointer select-none hover:bg-muted/50',
                  )}
                  onClick={() => onSortToggle?.(col)}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {onSortToggle && getSortIcon(col)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {displayCols.map((col) => {
                  const { text, type } = formatCell(row[col])
                  return (
                    <TableCell key={col} className="py-1 text-xs">
                      {type === 'null' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : type === 'boolean' ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px]',
                            text === 'true'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-red-500/10 text-red-600',
                          )}
                        >
                          {text}
                        </Badge>
                      ) : type === 'number' ? (
                        <span className="font-mono">{text}</span>
                      ) : type === 'date' ? (
                        <span className="text-violet-600 dark:text-violet-400">{text}</span>
                      ) : (
                        <span>{text}</span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
