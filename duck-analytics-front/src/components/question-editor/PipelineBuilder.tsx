import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Filter,
  Link2,
  Sigma,
  ArrowUpDown,
  Hash,
  Columns3,
  Layers,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/services/api'
import { toast } from '@/lib/toast'
import { PipelineStageCard } from './PipelineStageCard'
import { getDataSourceTerminology } from '@/hooks/use-datasource-terminology'
import type {
  PipelineStage,
  PipelineConfiguration,
  FieldSchema,
  DataSource,
} from '@/types'

const STAGE_ICONS: Record<PipelineStage['type'], React.ReactNode> = {
  '$match': <Filter size={14} />,
  '$lookup': <Link2 size={14} />,
  '$group': <Sigma size={14} />,
  '$sort': <ArrowUpDown size={14} />,
  '$limit': <Hash size={14} />,
  '$project': <Columns3 size={14} />,
  '$unwind': <Layers size={14} />,
}

const STAGE_TYPES: PipelineStage['type'][] = [
  '$match', '$lookup', '$group', '$sort', '$limit', '$project', '$unwind',
]

interface IntermediateResult {
  data: Record<string, unknown>[]
  count: number
  inferredFields: FieldSchema[]
}

interface Props {
  stages: PipelineStage[]
  config: PipelineConfiguration
  baseFields: FieldSchema[]
  dataSourceId: string
  collection: string
  collections: string[]
  dataSourceType?: DataSource['type']
  onAddStage: (type: PipelineStage['type']) => void
  onUpdateStage: (id: string, patch: Partial<PipelineStage>) => void
  onRemoveStage: (id: string) => void
  onToggleStage: (id: string) => void
  onMoveStage: (from: number, to: number) => void
  onPartialResult?: (data: Record<string, unknown>[]) => void
}

export function PipelineBuilder({
  stages,
  config,
  baseFields,
  dataSourceId,
  collection,
  collections,
  dataSourceType = 'MONGODB',
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onToggleStage,
  onMoveStage,
  onPartialResult,
}: Props) {
  const terminology = getDataSourceTerminology(dataSourceType)
  const stageOptions = useMemo(
    () =>
      STAGE_TYPES.map((type) => ({
        type,
        label: terminology.stageLabels[type] ?? type,
        icon: STAGE_ICONS[type],
      })),
    [terminology],
  )
  const [intermediateResults, setIntermediateResults] = useState<
    Map<string, IntermediateResult>
  >(new Map())
  const [runningStageId, setRunningStageId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const getAvailableFields = useCallback(
    (stageIndex: number): FieldSchema[] => {
      // Collect fields added by $lookup stages as we walk backward
      let lookupFields: FieldSchema[] = []

      for (let i = stageIndex - 1; i >= 0; i--) {
        // Intermediate result from running to here takes priority
        const result = intermediateResults.get(stages[i]!.id)
        if (result) return result.inferredFields

        const s = stages[i]!

        // Derive output fields from $group definition without needing to run it
        if (s.type === '$group' && s.enabled) {
          const derived: FieldSchema[] = [
            ...s.groupBy.map((f) => ({ name: f, type: 'mixed' as const })),
            ...s.aggregations
              .filter((a) => a.alias)
              .map((a) => ({ name: a.alias, type: 'number' as const })),
          ]
          if (derived.length > 0) return derived
        }

        // Derive output fields from $lookup — adds foreign collection fields
        if (s.type === '$lookup' && s.enabled && s._foreignFields?.length && s.as) {
          const prefix = s.as
          const foreignFields = s._foreignFields.map((f) => ({
            name: `${prefix}.${f.name}`,
            type: f.type,
          }))
          lookupFields = [...lookupFields, ...foreignFields]
        }
      }

      if (lookupFields.length > 0) {
        return [...baseFields, ...lookupFields]
      }
      return baseFields
    },
    [stages, intermediateResults, baseFields],
  )

  const stageFields = useMemo(() => {
    return stages.map((_, i) => getAvailableFields(i))
  }, [stages, getAvailableFields])

  async function handleRunToHere(stageId: string) {
    if (!dataSourceId || !collection) return
    setRunningStageId(stageId)
    try {
      const res = await api.post('/v1/queries/preview-partial', {
        dataSourceId,
        collection,
        configuration: config,
        upToStageId: stageId,
      })
      setIntermediateResults((prev) => {
        const next = new Map(prev)
        next.set(stageId, res.data as IntermediateResult)
        return next
      })
      onPartialResult?.(res.data.data as Record<string, unknown>[])
      toast.success(`${res.data.count} docs até este stage`)
    } catch {
      toast.error('Falha ao executar pipeline parcial')
    } finally {
      setRunningStageId(null)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = stages.findIndex((s) => s.id === active.id)
    const newIndex = stages.findIndex((s) => s.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      onMoveStage(oldIndex, newIndex)
    }
  }

  return (
    <div className="space-y-2">
      {stages.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Nenhum stage — clique em &quot;+ Stage&quot; para começar
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={stages.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {stages.map((stage, i) => (
              <PipelineStageCard
                key={stage.id}
                stage={stage}
                fields={stageFields[i] ?? baseFields}
                dataSourceId={dataSourceId}
                collections={collections}
                intermediateResult={intermediateResults.get(stage.id)}
                isRunningPartial={runningStageId === stage.id}
                onUpdate={(patch) => onUpdateStage(stage.id, patch)}
                onRemove={() => onRemoveStage(stage.id)}
                onToggle={() => onToggleStage(stage.id)}
                onRunToHere={() => handleRunToHere(stage.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
            <Plus size={13} />
            Adicionar Stage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {stageOptions.map(({ type, label, icon }) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onAddStage(type)}
              className="gap-2 text-xs"
            >
              {icon}
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
