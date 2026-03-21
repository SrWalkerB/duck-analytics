import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Play,
  Trash2,
  Filter,
  Link2,
  Sigma,
  ArrowUpDown,
  Hash,
  Columns3,
  Loader2,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import type { PipelineStage, FieldSchema } from '@/types'
import {
  MatchStageEditor,
  LookupStageEditor,
  GroupStageEditor,
  SortStageEditor,
  LimitStageEditor,
  ProjectStageEditor,
  UnwindStageEditor,
} from './stages'

const STAGE_META: Record<
  PipelineStage['type'],
  { label: string; icon: React.ReactNode }
> = {
  '$match': { label: 'Filtrar', icon: <Filter size={13} /> },
  '$lookup': { label: 'Join', icon: <Link2 size={13} /> },
  '$group': { label: 'Agrupar', icon: <Sigma size={13} /> },
  '$sort': { label: 'Ordenar', icon: <ArrowUpDown size={13} /> },
  '$limit': { label: 'Limite', icon: <Hash size={13} /> },
  '$project': { label: 'Projeção', icon: <Columns3 size={13} /> },
  '$unwind': { label: 'Unwind', icon: <Layers size={13} /> },
}

interface IntermediateResult {
  data: Record<string, unknown>[]
  count: number
  inferredFields: FieldSchema[]
}

interface Props {
  stage: PipelineStage
  fields: FieldSchema[]
  dataSourceId: string
  collections: string[]
  intermediateResult?: IntermediateResult
  isRunningPartial: boolean
  onUpdate: (patch: Partial<PipelineStage>) => void
  onRemove: () => void
  onToggle: () => void
  onRunToHere: () => void
}

export function PipelineStageCard({
  stage,
  fields,
  dataSourceId,
  collections,
  intermediateResult,
  isRunningPartial,
  onUpdate,
  onRemove,
  onToggle,
  onRunToHere,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const meta = STAGE_META[stage.type]

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card transition-opacity',
        !stage.enabled && 'opacity-50',
        isDragging && 'z-50 shadow-lg',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        <button
          className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-muted-foreground">{meta.icon}</span>
          {meta.label}
          <span className="text-[10px] text-muted-foreground">{stage.type}</span>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
            onClick={onRunToHere}
            disabled={isRunningPartial || !stage.enabled}
            title="Executar até aqui"
          >
            {isRunningPartial ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          </button>
          <Switch
            checked={stage.enabled}
            onCheckedChange={onToggle}
            className="scale-75"
          />
          <button
            className="text-muted-foreground hover:text-destructive transition-colors"
            onClick={onRemove}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t px-3 py-2">
          {stage.type === '$match' && (
            <MatchStageEditor stage={stage} fields={fields} onUpdate={onUpdate} />
          )}
          {stage.type === '$lookup' && (
            <LookupStageEditor
              stage={stage}
              fields={fields}
              dataSourceId={dataSourceId}
              collections={collections}
              onUpdate={onUpdate}
            />
          )}
          {stage.type === '$group' && (
            <GroupStageEditor stage={stage} fields={fields} onUpdate={onUpdate} />
          )}
          {stage.type === '$sort' && (
            <SortStageEditor stage={stage} fields={fields} onUpdate={onUpdate} />
          )}
          {stage.type === '$limit' && (
            <LimitStageEditor stage={stage} onUpdate={onUpdate} />
          )}
          {stage.type === '$project' && (
            <ProjectStageEditor stage={stage} fields={fields} onUpdate={onUpdate} />
          )}
          {stage.type === '$unwind' && (
            <UnwindStageEditor stage={stage} fields={fields} onUpdate={onUpdate} />
          )}
        </div>
      )}

      {/* Footer — intermediate result info */}
      {intermediateResult && (
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          {intermediateResult.count} docs &middot;{' '}
          {intermediateResult.inferredFields
            .slice(0, 5)
            .map((f) => f.name)
            .join(', ')}
          {intermediateResult.inferredFields.length > 5 && '…'}
        </div>
      )}
    </div>
  )
}
