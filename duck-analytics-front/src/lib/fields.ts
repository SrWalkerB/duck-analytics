import type { FieldSchema } from '@/types'

/**
 * Depth-first flatten of a FieldSchema tree.
 * Each returned entry keeps its full dot-path in `name` and drops `nested`,
 * making it suitable for combobox-style editors that expect a flat list.
 */
export function flattenFields(fields: FieldSchema[]): FieldSchema[] {
  const out: FieldSchema[] = []
  const walk = (list: FieldSchema[]) => {
    for (const f of list) {
      out.push({ name: f.name, type: f.type })
      if (f.nested && f.nested.length > 0) walk(f.nested)
    }
  }
  walk(fields)
  return out
}
