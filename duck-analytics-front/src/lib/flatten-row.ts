function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

function flattenValue(value: unknown, prefix: string, out: Record<string, unknown>): void {
  if (value === null || value === undefined) {
    out[prefix] = value
    return
  }

  // MongoDB ObjectId: { $oid: "..." }
  if (isPlainObject(value) && '$oid' in value && typeof value['$oid'] === 'string') {
    out[prefix] = value['$oid']
    return
  }

  // MongoDB Date: { $date: "..." }
  if (isPlainObject(value) && '$date' in value) {
    out[prefix] = value['$date']
    return
  }

  if (value instanceof Date) {
    out[prefix] = value.toISOString()
    return
  }

  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value)
    return
  }

  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      flattenValue(value[key], `${prefix}.${key}`, out)
    }
    return
  }

  out[prefix] = value
}

export function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const value = row[key]
    // Don't flatten simple _id strings
    if (key === '_id' && typeof value === 'string') {
      out[key] = value
      continue
    }
    flattenValue(value, key, out)
  }
  return out
}

export function flattenRows(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return data.map(flattenRow)
}
