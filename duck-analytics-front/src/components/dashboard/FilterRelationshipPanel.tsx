import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Columns3,
  GitCompareArrows,
  Link2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { DashboardFilter, FilterRelationship, FieldSchema } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  filters: DashboardFilter[]
  relationships: FilterRelationship[]
  onSave: (relationships: FilterRelationship[]) => void
}

type WizardStep = 1 | 2 | 3
type WizardMode = 'create' | 'edit' | null

interface RelationshipDraft {
  id: string | null
  sourceFilterId: string
  targetFilterId: string
  sourceField: string
  targetField: string
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
  const [wizardMode, setWizardMode] = useState<WizardMode>(null)
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RelationshipDraft>({
    id: null,
    sourceFilterId: '',
    targetFilterId: '',
    sourceField: '',
    targetField: '',
  })

  useEffect(() => {
    setRelationships(initialRelationships)
    setWizardMode(null)
    setWizardStep(1)
    setSelectedRelId(initialRelationships[0]?.id ?? null)
    setDraft({
      id: null,
      sourceFilterId: '',
      targetFilterId: '',
      sourceField: '',
      targetField: '',
    })
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

  const sourceFilter = filters.find((f) => f.id === draft.sourceFilterId)
  const targetFilter = filters.find((f) => f.id === draft.targetFilterId)

  const sourceSchemaQuery = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', sourceFilter?.dataSourceId, sourceFilter?.collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${sourceFilter!.dataSourceId}/collections/${sourceFilter!.collection}/schema`)
        .then((r) => r.data),
    enabled: !!sourceFilter,
  })

  const targetSchemaQuery = useQuery<{ fields: FieldSchema[] }>({
    queryKey: ['ds-schema', targetFilter?.dataSourceId, targetFilter?.collection],
    queryFn: () =>
      api
        .get(`/v1/data-sources/${targetFilter!.dataSourceId}/collections/${targetFilter!.collection}/schema`)
        .then((r) => r.data),
    enabled: !!targetFilter,
  })

  const sourceFields = sourceSchemaQuery.data?.fields ?? []
  const targetFields = targetSchemaQuery.data?.fields ?? []
  const sourceFieldType = sourceFields.find((f) => f.name === draft.sourceField)?.type
  const targetFieldType = targetFields.find((f) => f.name === draft.targetField)?.type
  const hasTypeMismatch = !!(sourceFieldType && targetFieldType && sourceFieldType !== targetFieldType)

  function resetWizard() {
    setWizardMode(null)
    setWizardStep(1)
    setDraft({
      id: null,
      sourceFilterId: '',
      targetFilterId: '',
      sourceField: '',
      targetField: '',
    })
  }

  function startCreateWizard() {
    setWizardMode('create')
    setWizardStep(1)
    setDraft({
      id: null,
      sourceFilterId: '',
      targetFilterId: '',
      sourceField: '',
      targetField: '',
    })
  }

  function startEditWizard(rel: FilterRelationship) {
    setSelectedRelId(rel.id)
    setWizardMode('edit')
    setWizardStep(1)
    setDraft({
      id: rel.id,
      sourceFilterId: rel.sourceFilterId,
      targetFilterId: rel.targetFilterId,
      sourceField: rel.sourceField,
      targetField: rel.targetField,
    })
  }

  function getBaseRelationships() {
    if (wizardMode === 'edit' && draft.id) {
      return relationships.filter((r) => r.id !== draft.id)
    }
    return relationships
  }

  function getAvailableTargets(sourceId: string) {
    if (!sourceId) return []
    return filters.filter((candidate) => {
      if (candidate.id === sourceId) return false
      return !detectCycle(getBaseRelationships(), {
        sourceFilterId: sourceId,
        targetFilterId: candidate.id,
      })
    })
  }

  function validateCurrentStep() {
    if (wizardStep === 1 && !draft.sourceFilterId) {
      toast.error('Selecione o filtro origem')
      return false
    }
    if (wizardStep === 2) {
      if (!draft.targetFilterId) {
        toast.error('Selecione o filtro destino')
        return false
      }
      if (draft.sourceFilterId === draft.targetFilterId) {
        toast.error('Origem e destino devem ser diferentes')
        return false
      }
      if (
        detectCycle(getBaseRelationships(), {
          sourceFilterId: draft.sourceFilterId,
          targetFilterId: draft.targetFilterId,
        })
      ) {
        toast.error('Esse relacionamento criaria um ciclo')
        return false
      }
    }
    if (wizardStep === 3 && (!draft.sourceField || !draft.targetField)) {
      toast.error('Selecione os campos de ligação')
      return false
    }
    return true
  }

  function handleNextStep() {
    if (!validateCurrentStep()) return
    if (wizardStep < 3) {
      setWizardStep((prev) => (prev + 1) as WizardStep)
    }
  }

  function handlePrevStep() {
    if (wizardStep > 1) {
      setWizardStep((prev) => (prev - 1) as WizardStep)
    }
  }

  function upsertRelationship() {
    if (!draft.sourceFilterId || !draft.targetFilterId || !draft.sourceField || !draft.targetField) {
      toast.error('Preencha todos os campos')
      return
    }

    const nextRelationship: FilterRelationship = {
      id: draft.id ?? crypto.randomUUID(),
      sourceFilterId: draft.sourceFilterId,
      targetFilterId: draft.targetFilterId,
      sourceField: draft.sourceField,
      targetField: draft.targetField,
    }

    setRelationships((prev) => {
      if (wizardMode === 'edit' && draft.id) {
        return prev.map((r) => (r.id === draft.id ? nextRelationship : r))
      }
      return [...prev, nextRelationship]
    })

    setSelectedRelId(nextRelationship.id)
    toast.success(wizardMode === 'edit' ? 'Relacionamento atualizado' : 'Relacionamento adicionado')
    resetWizard()
  }

  function removeRelationship(id: string) {
    setRelationships((prev) => prev.filter((r) => r.id !== id))
    if (selectedRelId === id) {
      const remaining = relationships.filter((r) => r.id !== id)
      setSelectedRelId(remaining[0]?.id ?? null)
    }
    toast.success('Relacionamento removido')
  }

  function createReverseRelationship(rel: FilterRelationship) {
    const alreadyExists = relationships.some(
      (r) =>
        r.sourceFilterId === rel.targetFilterId &&
        r.targetFilterId === rel.sourceFilterId &&
        r.sourceField === rel.targetField &&
        r.targetField === rel.sourceField,
    )

    if (alreadyExists) {
      toast.info('Relacionamento inverso já existe')
      return
    }

    const reversed: FilterRelationship = {
      id: crypto.randomUUID(),
      sourceFilterId: rel.targetFilterId,
      targetFilterId: rel.sourceFilterId,
      sourceField: rel.targetField,
      targetField: rel.sourceField,
    }

    setRelationships((prev) => [...prev, reversed])
    setSelectedRelId(reversed.id)
    toast.success('Relacionamento inverso criado')
  }

  function handleSave() {
    onSave(relationships)
    onClose()
  }

  const availableTargets = getAvailableTargets(draft.sourceFilterId)
  const selectedRelationship = relationships.find((r) => r.id === selectedRelId)
  const previewSourceFilter = wizardMode
    ? sourceFilter
    : selectedRelationship
      ? filters.find((f) => f.id === selectedRelationship.sourceFilterId)
      : undefined
  const previewTargetFilter = wizardMode
    ? targetFilter
    : selectedRelationship
      ? filters.find((f) => f.id === selectedRelationship.targetFilterId)
      : undefined
  const previewSourceField = wizardMode
    ? draft.sourceField
    : selectedRelationship?.sourceField
  const previewTargetField = wizardMode
    ? draft.targetField
    : selectedRelationship?.targetField
  const draftReverseExists =
    !!(draft.sourceFilterId && draft.targetFilterId && draft.sourceField && draft.targetField) &&
    relationships.some(
      (r) =>
        r.id !== draft.id &&
        r.sourceFilterId === draft.targetFilterId &&
        r.targetFilterId === draft.sourceFilterId &&
        r.sourceField === draft.targetField &&
        r.targetField === draft.sourceField,
    )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-h-[90vh] max-w-6xl overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>Relacionamentos entre filtros</DialogTitle>
        </DialogHeader>

        {filters.length < 2 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">
            Crie pelo menos 2 filtros no dashboard para configurar relacionamentos.
          </p>
        ) : (
          <div className="space-y-4 overflow-auto px-6 pb-4">
            <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
              <p className="text-xs font-medium text-muted-foreground">Preview do relacionamento</p>
              <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                <span>{previewSourceFilter?.label ?? 'Origem'}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  .{previewSourceField || 'campo'}
                </span>
                <ArrowRight className="h-4 w-4 text-primary" />
                <span>{previewTargetFilter?.label ?? 'Destino'}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  .{previewTargetField || 'campo'}
                </span>
              </div>
              {hasTypeMismatch && wizardMode && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tipos diferentes: <strong>{sourceFieldType}</strong> e{' '}
                    <strong>{targetFieldType}</strong>. O filtro pode não retornar resultados.
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="space-y-3">
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

                    {relationships.map((rel) => {
                      const src = filterMap.get(rel.sourceFilterId)
                      const tgt = filterMap.get(rel.targetFilterId)
                      if (!src || !tgt) return null
                      const srcPos = positions[src.index]
                      const tgtPos = positions[tgt.index]
                      if (!srcPos || !tgtPos) return null
                      const isActive = rel.id === selectedRelId
                      const { d, labelX, labelY } = buildArrowPath(srcPos, tgtPos)

                      return (
                        <g key={rel.id}>
                          <path
                            d={d}
                            fill="none"
                            className={cn('stroke-primary/30', isActive && 'stroke-primary')}
                            strokeWidth={isActive ? 2.5 : 1.5}
                            markerEnd="url(#rel-arrow)"
                          />
                          <rect
                            x={labelX - 70}
                            y={labelY - 10}
                            width={140}
                            height={16}
                            rx={4}
                            className={cn('fill-background/60', isActive && 'fill-background/90')}
                          />
                          <text
                            x={labelX}
                            y={labelY + 2}
                            textAnchor="middle"
                            className={cn('fill-muted-foreground', isActive && 'fill-foreground')}
                            fontSize={10}
                          >
                            {rel.sourceField} → {rel.targetField}
                          </text>
                        </g>
                      )
                    })}

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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Relacionamentos ({relationships.length})</h4>
                    {!wizardMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={startCreateWizard}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Novo relacionamento
                      </Button>
                    )}
                  </div>

                  {relationships.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                      Nenhum relacionamento criado ainda.
                    </div>
                  )}

                  {relationships.map((rel) => {
                    const src = filterMap.get(rel.sourceFilterId)?.filter
                    const tgt = filterMap.get(rel.targetFilterId)?.filter
                    const active = selectedRelId === rel.id
                    return (
                      <div
                        key={rel.id}
                        className={cn(
                          'rounded-lg border px-3 py-2 transition-colors',
                          active && 'border-primary bg-primary/5',
                        )}
                        onClick={() => setSelectedRelId(rel.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-medium">{src?.label ?? '?'}</span>
                            <span className="text-muted-foreground">.{rel.sourceField}</span>
                            <span className="mx-2 text-muted-foreground">→</span>
                            <span className="font-medium">{tgt?.label ?? '?'}</span>
                            <span className="text-muted-foreground">.{rel.targetField}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditWizard(rel)
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeRelationship(rel.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h5 className="text-sm font-semibold">
                      {wizardMode === 'edit' ? 'Editar relacionamento' : 'Assistente de relacionamento'}
                    </h5>
                    {wizardMode && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetWizard}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {!wizardMode ? (
                    <div className="space-y-2 rounded-lg border border-dashed p-4">
                      <p className="text-xs text-muted-foreground">
                        Crie ou edite relacionamentos em 3 passos simples: origem, destino e campos.
                      </p>
                      <Button size="sm" className="w-full gap-1" onClick={startCreateWizard}>
                        <Link2 className="h-3.5 w-3.5" />
                        Iniciar assistente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {wizardMode === 'edit' && (
                        <div className="rounded-md border bg-muted/20 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              Quer habilitar também o sentido inverso?
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() =>
                                createReverseRelationship({
                                  id: draft.id ?? crypto.randomUUID(),
                                  sourceFilterId: draft.sourceFilterId,
                                  targetFilterId: draft.targetFilterId,
                                  sourceField: draft.sourceField,
                                  targetField: draft.targetField,
                                })
                              }
                              disabled={
                                !draft.sourceFilterId ||
                                !draft.targetFilterId ||
                                !draft.sourceField ||
                                !draft.targetField ||
                                draftReverseExists
                              }
                              title={
                                draftReverseExists
                                  ? 'Relacionamento inverso já existe'
                                  : 'Criar relacionamento no sentido inverso'
                              }
                            >
                              <GitCompareArrows className="h-3 w-3" />
                              {draftReverseExists ? 'Inverso OK' : 'Criar inverso'}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((step) => {
                          const isActive = wizardStep === step
                          const isDone = wizardStep > step
                          return (
                            <div
                              key={step}
                              className={cn(
                                'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                                isActive && 'border-primary bg-primary/10',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex h-5 w-5 items-center justify-center rounded-full border text-[10px]',
                                  isDone && 'border-primary bg-primary text-primary-foreground',
                                )}
                              >
                                {isDone ? <Check className="h-3 w-3" /> : step}
                              </span>
                              <span>{step === 1 ? 'Origem' : step === 2 ? 'Destino' : 'Campos'}</span>
                            </div>
                          )
                        })}
                      </div>

                      {wizardStep === 1 && (
                        <div className="space-y-2">
                          <Label className="text-xs">1. Escolha o filtro de origem</Label>
                          <p className="text-xs text-muted-foreground">
                            Este filtro vai enviar os valores para filtrar o próximo.
                          </p>
                          <FilterSelect
                            filters={filters}
                            value={draft.sourceFilterId}
                            onValueChange={(value) =>
                              setDraft({
                                ...draft,
                                sourceFilterId: value,
                                targetFilterId: '',
                                sourceField: '',
                                targetField: '',
                              })
                            }
                            placeholder="Selecionar origem..."
                          />
                        </div>
                      )}

                      {wizardStep === 2 && (
                        <div className="space-y-2">
                          <Label className="text-xs">2. Escolha o filtro de destino</Label>
                          <p className="text-xs text-muted-foreground">
                            O filtro destino terá seus itens reduzidos com base na origem.
                          </p>
                          <FilterSelect
                            filters={availableTargets}
                            value={draft.targetFilterId}
                            onValueChange={(value) =>
                              setDraft({
                                ...draft,
                                targetFilterId: value,
                                targetField: '',
                              })
                            }
                            placeholder="Selecionar destino..."
                          />
                          {draft.sourceFilterId && availableTargets.length === 0 && (
                            <p className="text-xs text-amber-300">
                              Não há destinos válidos para essa origem sem criar ciclo.
                            </p>
                          )}
                        </div>
                      )}

                      {wizardStep === 3 && (
                        <div className="space-y-3">
                          <Label className="text-xs">3. Defina os campos de ligação</Label>
                          <p className="text-xs text-muted-foreground">
                            Exemplo: <code>categorias._id</code> → <code>produtos.categoryId</code>
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Campo da origem</Label>
                              <FieldSelect
                                fields={sourceFields}
                                value={draft.sourceField}
                                onValueChange={(v) => setDraft({ ...draft, sourceField: v })}
                                placeholder="Selecionar campo..."
                                loading={sourceSchemaQuery.isLoading}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Campo do destino</Label>
                              <FieldSelect
                                fields={targetFields}
                                value={draft.targetField}
                                onValueChange={(v) => setDraft({ ...draft, targetField: v })}
                                placeholder="Selecionar campo..."
                                loading={targetSchemaQuery.isLoading}
                              />
                            </div>
                          </div>

                          {hasTypeMismatch && (
                            <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                Tipos diferentes: <strong>{sourceFieldType}</strong> e{' '}
                                <strong>{targetFieldType}</strong>. O filtro pode não retornar resultados.
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handlePrevStep}
                          disabled={wizardStep === 1}
                        >
                          Voltar
                        </Button>
                        {wizardStep < 3 ? (
                          <Button size="sm" className="ml-auto" onClick={handleNextStep}>
                            Próximo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="ml-auto gap-1"
                            onClick={upsertRelationship}
                            disabled={!draft.sourceField || !draft.targetField}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {wizardMode === 'edit' ? 'Salvar relacionamento' : 'Adicionar relacionamento'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>
                      Dica: comece sempre pelo filtro mais geral (ex.: Categoria) e depois conecte os filtros
                      mais específicos (ex.: Produto).
                    </span>
                  </div>
                </div>
              </div>
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

function FilterSelect({
  filters,
  value,
  onValueChange,
  placeholder,
}: {
  filters: DashboardFilter[]
  value: string
  onValueChange: (v: string) => void
  placeholder: string
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? filters.filter((f) => f.label.toLowerCase().includes(search.toLowerCase()))
    : filters

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-sm">
        <span className="flex flex-1 items-center">
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        <div className="p-1">
          <Input
            className="h-7 text-xs"
            placeholder="Buscar filtro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {filtered.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.label}
          </SelectItem>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nenhum filtro encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

function FieldSelect({
  fields,
  value,
  onValueChange,
  placeholder,
  loading,
}: {
  fields: FieldSchema[]
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? fields.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : fields
  return (
    <Select value={value} onValueChange={onValueChange} disabled={loading}>
      <SelectTrigger className="h-8 text-sm">
        <span className="flex flex-1 items-center">
          <Columns3 className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={loading ? 'Carregando...' : placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        <div className="p-1">
          <Input
            className="h-7 text-xs"
            placeholder="Buscar campo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {filtered.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.name} <span className="text-muted-foreground">({f.type})</span>
          </SelectItem>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nenhum campo encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
