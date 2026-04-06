interface ExportOptions {
  data: Record<string, unknown>[]
  columns?: string[]
  columnAliases?: Record<string, string>
  filename?: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function resolveColumns(data: Record<string, unknown>[], columns?: string[]) {
  if (columns?.length) return columns
  if (data.length === 0) return []
  return Object.keys(data[0]!)
}

function escapeCSV(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportCSV({ data, columns, columnAliases, filename = 'export' }: ExportOptions) {
  if (!data.length) return
  const cols = resolveColumns(data, columns)
  const headers = cols.map((c) => columnAliases?.[c] || c)

  const lines = [headers.map(escapeCSV).join(',')]
  for (const row of data) {
    lines.push(cols.map((c) => escapeCSV(row[c])).join(','))
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${filename}.csv`)
}

export async function exportExcel({ data, columns, columnAliases, filename = 'export' }: ExportOptions) {
  if (!data.length) return
  const cols = resolveColumns(data, columns)
  const headers = cols.map((c) => columnAliases?.[c] || c)

  const XLSX = await import('xlsx')
  const rows = data.map((row) => cols.map((c) => row[c] ?? ''))
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${filename}.xlsx`)
}
