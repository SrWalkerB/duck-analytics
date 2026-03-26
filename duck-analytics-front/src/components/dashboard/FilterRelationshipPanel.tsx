import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { DashboardFilter, FilterRelationship, FieldSchema } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

interface Props {
  open: boolean
  onClose: () => void
  filters: DashboardFilter[]
  relationships: FilterRelationship[]
  onSave: (relationships: FilterRelationship[]) => void
}

const NODE_W = 180
const NODE_H = 64
const PAD = 60
const GAP_X = 120
const GAP_Y = 120

function computeNodePositions(count: number) {
  const cols = Math.min(count, 4)
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      x: PAD + col * (NODE_W + GAP_X),
      y: PAD + row * (NODE_H + GAP_Y),
    })
  }
  return positions
}

/** Build an SVG path between two node rects — chooses the best anchor side */
function buildArrowPath(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): { d: string; labelX: number; labelY: number } {
  const srcCx = src.x + NODE_W / 2
  const srcCy = src.y + NODE_H / 2
  const tgtCx = tgt.x + NODE_W / 2
  const tgtCy = tgt.y + NODE_H / 2

  const dx = tgtCx - srcCx
  const dy = tgtCy - srcCy

  let x1: number, y1: number, x2: number, y2: number

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection (right→left)
    if (dx > 0) {
      x1 = src.x + NODE_W
      y1 = srcCy
      x2 = tgt.x
      y2 = tgtCy
    } else {
      x1 = src.x
      y1 = srcCy
      x2 = tgt.x + NODE_W
      y2 = tgtCy
    }
    const cpOffset = Math.abs(x2 - x1) * 0.4
    const d = `M ${x1} ${y1} C ${x1 + Math.sign(dx) * cpOffset} ${y1}, ${x2 - Math.sign(dx) * cpOffset} ${y2}, ${x2} ${y2}`
    return { d, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2 - 10 }
  } else {
    // Vertical connection (bottom→top)
    if (dy > 0) {
      x1 = srcCx
      y1 = src.y + NODE_H
      x2 = tgtCx
      y2 = tgt.y
    } else {
      x1 = srcCx
      y1 = src.y
      x2 = tgtCx
      y2 = tgt.y + NODE_H
    }
    const cpOffset = Math.abs(y2 - y1) * 0.4
    const d = `M ${x1} ${y1} C ${x1} ${y1 + Math.sign(dy) * cpOffset}, ${x2} ${y2 - Math.sign(dy) * cpOffset}, ${x2} ${y2}`
    return { d, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2 - 10 }
  }
}

function detectCycle(
  relationships: FilterRelationship[],
  newRel: { sourceFilterId: string; targetFilterId: string },
): boolean {
  const edges = [
    ...relationships.map((r) => [r.sourceFilterId, r.targetFilterId] as const),
    [newRel.sourceFilterId, newRel.targetFilterId] as const,
  ]
  const adj = new Map<string, string[]>()
  for (const [from, to] of edges) {
    if (!adj.has(from)) adj.set(from, [])
    adj.get(from)!.push(to)
  }
  const visited = new Set<string>()
  const stack = new Set<string>()
  function dfs(node: string): boolean {
    if (stack.has(node)) return true
    if (visited.has(node)) return false
    visited.add(node)
    stack.add(node)
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true
    }
    stack.delete(node)
    return false
  }
  for (const [from] of edges) {
    if (!visited.has(from) && dfs(from)) return true
  }
  return false
}

export function FilterRelationshipPanel({
  open,
  onClose,
  filters,
  relationships: initialRelationships,
  onSave,
}: Props) {
  const [relationships, setRelationships] = useState<FilterRelationship[]>(initialRelationships)
  const [adding, setAdding] = useState(false)
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newSourceField, setNewSourceField] = useState('')
  const [newTargetField, setNewTargetField] = useState('')

  useEffect(() => {
    setRelationships(initialRelationships)
  }, [initialRelationships, open])

  const positions = useMemo(() => computeNodePositions(filters.length), [filters.length])

  const filterMap = useMemo(() => {
    const map = new Map<string, { filter: DashboardFilter; index: number }>()
    filters.forEach((f, i) => map.set(f.id, { filter: f, index: i }))
    return map
  }, [filters])

  const lastPos = positions[positions.length - 1]
  const svgW = Math.max(500, (lastPos?.x ?? 0) + NODE_W + PAD)
  const svgH = Math.max(200, (lastPos?.y ?? 0) + NODE_H + PAD)

  function handleAddRelationship() {
    if (!newSource || !newTarget || !newSourceField || !newTargetField) {
      toast.error('Preencha todos os campos')
      return
    }
    if (newSource === newTarget) {
      toast.error('Filtro origem e destino devem ser diferentes')
      return
    }
    if (detectCycle(relationships, { sourceFilterId: newSource, targetFilterId: newTarget })) {
      toast.error('Esse relacionamento criaria um ciclo')
      return
    }
    setRelationships((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sourceFilterId: newSource,
        targetFilterId: newTarget,
        sourceField: newSourceField,
        targetField: newTargetField,
      },
    ])
    resetForm()
  }

  function resetForm() {
    setAdding(false)
    setNewSource('')
    setNewTarget('')
    setNewSourceField('')
    setNewTargetField('')
  }

  function removeRelationship(id: string) {
    setRelationships((prev) => prev.filter((r) => r.id !== id))
  }

  function handleSave() {
    onSave(relationships)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>Relacionamentos entre filtros</DialogTitle>
        </DialogHeader>

        {filters.length < 2 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">
            Crie pelo menos 2 filtros no dashboard para configurar relacionamentos.
          </p>
        ) : (
          <div className="flex-1 overflow-auto px-6 space-y-4">
            {/* ─── Diagram ─── */}
            <div className="overflow-auto rounded-lg border bg-muted/20 p-2">
              <svg
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                style={{ minWidth: svgW, minHeight: svgH }}
              >
                <defs>
                  <marker
                    id="rel-arrow"
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 4, 0 8" className="fill-primary" />
                  </marker>
                </defs>

                {/* Arrows */}
                {relationships.map((rel) => {
                  const src = filterMap.get(rel.sourceFilterId)
                  const tgt = filterMap.get(rel.targetFilterId)
                  if (!src || !tgt) return null
                  const srcPos = positions[src.index]
                  const tgtPos = positions[tgt.index]
                  if (!srcPos || !tgtPos) return null

                  const { d, labelX, labelY } = buildArrowPath(srcPos, tgtPos)

                  return (
                    <g key={rel.id}>
                      <path
                        d={d}
                        fill="none"
                        className="stroke-primary"
                        strokeWidth={2}
                        markerEnd="url(#rel-arrow)"
                      />
                      {/* Label background */}
                      <rect
                        x={labelX - 60}
                        y={labelY - 10}
                        width={120}
                        height={16}
                        rx={4}
                        className="fill-background/80"
                      />
                      <text
                        x={labelX}
                        y={labelY + 2}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        fontSize={10}
                      >
                        {rel.sourceField} → {rel.targetField}
                      </text>
                    </g>
                  )
                })}

                {/* Nodes */}
                {filters.map((filter, i) => {
                  const pos = positions[i]
                  if (!pos) return null
                  return (
                    <g key={filter.id}>
                      <rect
                        x={pos.x}
                        y={pos.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={10}
                        className="fill-card stroke-border"
                        strokeWidth={1.5}
                      />
                      <text
                        x={pos.x + NODE_W / 2}
                        y={pos.y + 26}
                        textAnchor="middle"
                        className="fill-foreground"
                        fontSize={13}
                        fontWeight={500}
                      >
                        {filter.label}
                      </text>
                      <text
                        x={pos.x + NODE_W / 2}
                        y={pos.y + 44}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        fontSize={10}
                      >
                        {filter.collection}.{filter.field}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* ─── Relationship list ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Relacionamentos ({relationships.length})
                </h4>
                {!adding && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => setAdding(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Novo relacionamento
                  </Button>
                )}
              </div>

              {relationships.map((rel) => {
                const src = filterMap.get(rel.sourceFilterId)?.filter
                const tgt = filterMap.get(rel.targetFilterId)?.filter
                return (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{src?.label ?? '?'}</span>
                      <span className="text-muted-foreground">.{rel.sourceField}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium">{tgt?.label ?? '?'}</span>
                      <span className="text-muted-foreground">.{rel.targetField}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeRelationship(rel.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )
              })}

              {/* Add form */}
              {adding && (
                <div className="space-y-3 rounded-lg border border-primary/40 bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium">Novo relacionamento</h5>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={resetForm}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Filtro origem</Label>
                      <Select
                        value={newSource}
                        onValueChange={(v) => { setNewSource(v); setNewSourceField('') }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filters.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Filtro destino</Label>
                      <Select
                        value={newTarget}
                        onValueChange={(v) => { setNewTarget(v); setNewTargetField('') }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filters
                            .filter((f) => f.id !== newSource)
                            .map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {newSource && (
                      <div className="space-y-1">
                        <Label className="text-xs">Campo origem</Label>
                        <RelFieldSelect
                          filter={filters.find((f) => f.id === newSource)!}
                          value={newSourceField}
                          onChange={setNewSourceField}
                        />
                      </div>
                    )}

                    {newTarget && (
                      <div className="space-y-1">
                        <Label className="text-xs">Campo destino</Label>
                        <RelFieldSelect
                          filter={filters.find((f) => f.id === newTarget)!}
                          value={newTargetField}
                          onChange={setNewTargetField}
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!newSource || !newTarget || !newSourceField || !newTargetField}
                    onClick={handleAddRelationship}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Field select for a filter's collection schema */
function RelFieldSelect({
  filter,
  value,
  onChange,
}: {
  filter: DashboardFilter
  value: string
  onChange: (v: string) => void
}) {
  const { data: schemaData } = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', filter.dataSourceId, filter.collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${filter.dataSourceId}/collections/${filter.collection}/schema`)
        .then((r) => r.data),
  })

  const fields = schemaData?.fields ?? []

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Selecionar..." />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
