import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Link2, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { flattenFields } from '@/lib/fields'
import type { ProjectStage, FieldSchema } from '@/types'

interface Props {
  stage: ProjectStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<ProjectStage>) => void
}

export function ProjectStageEditor({ stage, fields, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const include = stage.include
  const includeSet = useMemo(() => new Set(include), [include])

  function setInclude(next: string[]) {
    onUpdate({ include: next })
  }

  // Toggling a field enforces MongoDB's rule: you cannot mix a parent path
  // (`questions: 1`) and a child path (`questions.foo: 1`) in the same
  // `$project`. Selecting a child strips any ancestor; selecting a parent
  // strips any descendant.
  function toggleField(fieldName: string, checked: boolean) {
    if (checked) {
      const withoutAncestors = include.filter(
        (f) => !fieldName.startsWith(`${f}.`),
      )
      const withoutDescendants = withoutAncestors.filter(
        (f) => !f.startsWith(`${fieldName}.`),
      )
      setInclude([...withoutDescendants, fieldName])
    } else {
      setInclude(include.filter((f) => f !== fieldName))
    }
  }

  function toggleExpanded(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function isImpliedByAncestor(name: string): boolean {
    // A field is implied when a shorter ancestor path is already in include.
    for (const sel of includeSet) {
      if (name.startsWith(`${sel}.`)) return true
    }
    return false
  }

  const searchTerm = search.trim().toLowerCase()
  const isSearching = searchTerm.length > 0

  const flatMatches = useMemo(() => {
    if (!isSearching) return []
    return flattenFields(fields).filter((f) =>
      f.name.toLowerCase().includes(searchTerm),
    )
  }, [fields, isSearching, searchTerm])

  function renderRow(field: FieldSchema, depth: number) {
    const hasChildren = !!field.nested && field.nested.length > 0
    const isExpanded = expanded.has(field.name)
    const checked = includeSet.has(field.name)
    const implied = !checked && isImpliedByAncestor(field.name)
    const rowId = `proj-${stage.id}-${field.name}`

    return (
      <div key={field.name}>
        <div
          className="flex items-center gap-1.5 rounded py-1 hover:bg-muted/50"
          style={{ paddingLeft: depth * 14 + 2 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(field.name)}
              className="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
          ) : (
            <span className="inline-block size-4 shrink-0" />
          )}
          <Checkbox
            id={rowId}
            checked={checked || implied}
            disabled={implied}
            onCheckedChange={(v) => toggleField(field.name, v === true)}
            className="size-3.5"
          />
          <label
            htmlFor={rowId}
            className={
              'flex-1 cursor-pointer truncate py-0.5 text-xs ' +
              (implied ? 'text-muted-foreground' : '')
            }
          >
            {/* Inside the tree we show only the last segment so deep paths
                stay readable (full path is still what we toggle). Top-level
                entries keep their full name — this matters for flat entries
                that carry dot-notation but no tree parent (e.g. $lookup
                outputs like `users.email`). */}
            {depth > 0
              ? field.name.slice(field.name.lastIndexOf('.') + 1)
              : field.name}
          </label>
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground">
              {'{}'}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {field.nested!.map((child) => renderRow(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] text-muted-foreground">Campos a incluir</Label>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Execute um stage anterior para ver os campos
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campo..."
              className="h-7 pl-7 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isSearching ? (
              flatMatches.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Nenhum campo encontrado
                </p>
              ) : (
                flatMatches.map((f) => {
                  const checked = includeSet.has(f.name)
                  const implied = !checked && isImpliedByAncestor(f.name)
                  const rowId = `proj-${stage.id}-search-${f.name}`
                  return (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={rowId}
                        checked={checked || implied}
                        disabled={implied}
                        onCheckedChange={(v) =>
                          toggleField(f.name, v === true)
                        }
                        className="size-3.5"
                      />
                      <label
                        htmlFor={rowId}
                        className={
                          'flex flex-1 cursor-pointer items-center gap-1 truncate py-0.5 text-xs ' +
                          (implied ? 'text-muted-foreground' : '')
                        }
                      >
                        {f.name.includes('.') && (
                          <Link2
                            size={9}
                            className="shrink-0 text-muted-foreground"
                          />
                        )}
                        {f.name}
                      </label>
                    </div>
                  )
                })
              )
            ) : (
              fields.map((f) => renderRow(f, 0))
            )}
          </div>
        </>
      )}
    </div>
  )
}
