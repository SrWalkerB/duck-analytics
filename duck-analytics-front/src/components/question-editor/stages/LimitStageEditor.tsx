import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LimitStage } from '@/types'

interface Props {
  stage: LimitStage
  onUpdate: (patch: Partial<LimitStage>) => void
}

export function LimitStageEditor({ stage, onUpdate }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground">Máximo de documentos</Label>
      <Input
        type="number"
        className="h-7 w-32 text-xs"
        value={stage.limit}
        min={1}
        onChange={(e) => onUpdate({ limit: parseInt(e.target.value) || 1000 })}
      />
    </div>
  )
}
