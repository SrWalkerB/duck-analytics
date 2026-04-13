import { useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Settings2, FileDown, FileSpreadsheet } from 'lucide-react'
import { flattenRows } from '@/lib/flatten-row'
import { exportCSV, exportExcel } from '@/lib/export-table'
import {
  formatDate,
  formatNumber,
  type ColumnFormat,
} from '@/lib/column-format'
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type PaginationMode = 'infinite' | 'paginated'
export type ExportFormat = 'csv' | 'excel'

interface ResultsTableProps {
  data: Record<string, unknown>[]
  visibleColumns?: string[]
  onVisibleColumnsChange?: (cols: string[]) => void
  sort?: QuerySort[]
  onSortToggle?: (field: string) => void
  columnAliases?: Record<string, string>
  columnOrder?: string[]
  exportFilename?: string
  /** Show the "Colunas" (edit columns) dropdown. Only true in the component editor preview. */
  editable?: boolean
  /** 'paginated' shows page navigation; 'infinite' appends more rows on scroll. */
  paginationMode?: PaginationMode
  /** Rows per page (paginated) or chunk size (infinite). */
  pageSize?: number
  /** Which export buttons to render. */
  exportFormats?: ExportFormat[]
  /** Per-column format overrides (type + options). */
  columnFormats?: Record<string, ColumnFormat>
}

function formatCell(
  value: unknown,
  override?: ColumnFormat,
): { text: string; type: 'null' | 'number' | 'boolean' | 'date' | 'text' } {
  if (value === null || value === undefined) return { text: '—', type: 'null' }

  // If the user configured an explicit format for this column, apply it first.
  if (override?.type === 'date') {
    const text = formatDate(value, override)
    if (text !== null) return { text, type: 'date' }
  }
  if (override?.type === 'number') {
    const text = formatNumber(value, override)
    if (text !== null) return { text, type: 'number' }
  }

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
  columnAliases,
  columnOrder,
  exportFilename,
  editable = false,
  paginationMode = 'paginated',
  pageSize = 100,
  exportFormats = ['csv', 'excel'],
  columnFormats,
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
    const detected = Array.from(cols)
    // Apply columnOrder if provided
    if (columnOrder?.length) {
      const ordered = columnOrder.filter((c) => detected.includes(c))
      const remaining = detected.filter((c) => !columnOrder.includes(c))
      return [...ordered, ...remaining]
    }
    return detected
  }, [flatData, columnOrder])

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

  // --- Pagination / infinite scroll state ---
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(flatData.length / safePageSize))
  const [page, setPage] = useState(0)
  const [visibleCount, setVisibleCount] = useState(safePageSize)

  // Reset pagination state when mode / page size / dataset size changes.
  // Uses the "storing information from previous renders" pattern so we avoid
  // cascading-render warnings from setState-in-useEffect.
  const resetKey = `${paginationMode}|${safePageSize}|${flatData.length}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey)
    setPage(0)
    setVisibleCount(safePageSize)
  }

  const rows = useMemo(() => {
    if (paginationMode === 'infinite') {
      return flatData.slice(0, Math.min(visibleCount, flatData.length))
    }
    const start = page * safePageSize
    return flatData.slice(start, start + safePageSize)
  }, [flatData, paginationMode, page, safePageSize, visibleCount])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (paginationMode !== 'infinite') return
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount((v) => Math.min(v + safePageSize, flatData.length))
    }
  }

  function colLabel(col: string) {
    return columnAliases?.[col] || col
  }

  // Build compact page list (1 … current-1 current current+1 … last)
  const pageItems = useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    const items: (number | 'ellipsis')[] = []
    const add = (n: number | 'ellipsis') => items.push(n)
    add(0)
    if (page > 2) add('ellipsis')
    const start = Math.max(1, page - 1)
    const end = Math.min(totalPages - 2, page + 1)
    for (let i = start; i <= end; i++) add(i)
    if (page < totalPages - 3) add('ellipsis')
    add(totalPages - 1)
    return items
  }, [page, totalPages])

  const scrollRef = useRef<HTMLDivElement>(null)

  const paginationControls =
    paginationMode === 'paginated' && totalPages > 1 ? (
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => {
                e.preventDefault()
                setPage((p) => Math.max(0, p - 1))
              }}
              aria-disabled={page === 0}
              className={cn(page === 0 && 'pointer-events-none opacity-50')}
            />
          </PaginationItem>
          {pageItems.map((it, i) =>
            it === 'ellipsis' ? (
              <PaginationItem key={`e-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={it}>
                <PaginationLink
                  isActive={it === page}
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(it)
                  }}
                >
                  {it + 1}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              onClick={(e) => {
                e.preventDefault()
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }}
              aria-disabled={page >= totalPages - 1}
              className={cn(page >= totalPages - 1 && 'pointer-events-none opacity-50')}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ) : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar: row count (left) · columns (right) */}
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5">
        <span className="shrink-0 text-xs text-muted-foreground">
          {rows.length} / {flatData.length} linhas · {displayCols.length} colunas
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {editable && (
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
                    <span className="truncate">{colLabel(col)}</span>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible"
      >
        <Table className="min-w-max">
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
                    {colLabel(col)}
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
                  const { text, type } = formatCell(row[col], columnFormats?.[col])
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

      {/* Footer: page indicator (left) · pagination (center) · export buttons (right) */}
      {(paginationMode === 'paginated' ||
        exportFormats.includes('csv') ||
        exportFormats.includes('excel')) && (
        <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1.5">
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {paginationMode === 'paginated' && totalPages > 1
              ? `Página ${page + 1} de ${totalPages}`
              : ''}
          </span>
          <div className="flex flex-1 items-center justify-center">
            {paginationControls}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {exportFormats.includes('csv') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                title="Exportar CSV"
                onClick={() =>
                  exportCSV({
                    data: flatData,
                    columns: displayCols,
                    columnAliases,
                    filename: exportFilename,
                  })
                }
              >
                <FileDown size={12} />
                CSV
              </Button>
            )}
            {exportFormats.includes('excel') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                title="Exportar Excel"
                onClick={() =>
                  exportExcel({
                    data: flatData,
                    columns: displayCols,
                    columnAliases,
                    filename: exportFilename,
                  })
                }
              >
                <FileSpreadsheet size={12} />
                Excel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
