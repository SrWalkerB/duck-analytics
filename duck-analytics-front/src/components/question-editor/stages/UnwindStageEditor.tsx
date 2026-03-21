import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UnwindStage, FieldSchema } from '@/types'

interface Props {
  stage: UnwindStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<UnwindStage>) => void
}

export function UnwindStageEditor({ stage, fields, onUpdate }: Props) {
  const arrayFields = fields.filter((f) => f.type === 'array')

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Campo (array)</Label>
        <Select value={stage.path} onValueChange={(v) => onUpdate({ path: v })}>
          <SelectTrigger className="h-6 text-xs">
            <SelectValue placeholder="campo array" />
          </SelectTrigger>
          <SelectContent>
            {arrayFields.length > 0
              ? arrayFields.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))
              : fields.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`preserve-null-${stage.id}`}
          checked={stage.preserveNullAndEmptyArrays}
          onCheckedChange={(v) => onUpdate({ preserveNullAndEmptyArrays: v === true })}
        />
        <label
          htmlFor={`preserve-null-${stage.id}`}
          className="cursor-pointer text-xs text-muted-foreground"
        >
          Preservar documentos com array vazio/null
        </label>
      </div>
    </div>
  )
}
