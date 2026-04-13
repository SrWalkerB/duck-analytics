// Column formatting — Metabase-style per-column type + format overrides.
// Used by ResultsTable to render cells and by the QuestionEditor UI to let
// users pick formats for each column.

export type DateSeparator = 'slash' | 'dash' | 'dot'
export type DateOrder = 'DMY' | 'MDY' | 'YMD'
export type DateTimeMode = 'off' | 'hm' | 'hms' | 'hmsms'

export interface DateFormat {
  type: 'date'
  separator: DateSeparator
  order: DateOrder
  time: DateTimeMode
}

export interface NumberFormat {
  type: 'number'
  decimals: number
  thousands: boolean
  prefix?: string
  suffix?: string
}

export type ColumnFormat = DateFormat | NumberFormat

export type ColumnType = 'date' | 'number' | 'boolean' | 'text'

export const DEFAULT_DATE_FORMAT: DateFormat = {
  type: 'date',
  separator: 'slash',
  order: 'DMY',
  time: 'off',
}

export const DEFAULT_NUMBER_FORMAT: NumberFormat = {
  type: 'number',
  decimals: 0,
  thousands: true,
}

function sepChar(s: DateSeparator): string {
  return s === 'slash' ? '/' : s === 'dash' ? '-' : '.'
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(value: unknown, fmt: DateFormat): string | null {
  const d = toDate(value)
  if (!d) return null
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  const s = sepChar(fmt.separator)
  const datePart =
    fmt.order === 'DMY'
      ? `${dd}${s}${mm}${s}${yyyy}`
      : fmt.order === 'MDY'
        ? `${mm}${s}${dd}${s}${yyyy}`
        : `${yyyy}${s}${mm}${s}${dd}`
  if (fmt.time === 'off') return datePart
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  if (fmt.time === 'hm') return `${datePart} ${hh}:${mi}`
  const ss = String(d.getSeconds()).padStart(2, '0')
  if (fmt.time === 'hms') return `${datePart} ${hh}:${mi}:${ss}`
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${datePart} ${hh}:${mi}:${ss}.${ms}`
}

export function formatNumber(value: unknown, fmt: NumberFormat): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!isFinite(n)) return null
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: fmt.decimals,
    maximumFractionDigits: fmt.decimals,
    useGrouping: fmt.thousands,
  })
  return `${fmt.prefix ?? ''}${formatted}${fmt.suffix ?? ''}`
}

/**
 * Try to auto-detect a column's type by sampling rows.
 * Returns the type that covers ≥70% of non-null values, or 'text'.
 */
export function detectColumnType(
  rows: Record<string, unknown>[],
  col: string,
): ColumnType {
  let dateHits = 0
  let numHits = 0
  let boolHits = 0
  let total = 0
  const sample = rows.slice(0, 50)
  for (const row of sample) {
    const v = row[col]
    if (v == null) continue
    total++
    if (typeof v === 'boolean') boolHits++
    else if (typeof v === 'number') numHits++
    else if (v instanceof Date) dateHits++
    else if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) dateHits++
      else if (v !== '' && !isNaN(Number(v))) numHits++
    }
  }
  if (total === 0) return 'text'
  if (dateHits / total >= 0.7) return 'date'
  if (numHits / total >= 0.7) return 'number'
  if (boolHits / total >= 0.7) return 'boolean'
  return 'text'
}
