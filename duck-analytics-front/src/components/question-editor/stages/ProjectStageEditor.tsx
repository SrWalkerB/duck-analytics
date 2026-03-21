import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ProjectStage, FieldSchema } from '@/types'

interface Props {
  stage: ProjectStage
  fields: FieldSchema[]
  onUpdate: (patch: Partial<ProjectStage>) => void
}

export function ProjectStageEditor({ stage, fields, onUpdate }: Props) {
  function toggleField(fieldName: string, included: boolean) {
    if (included) {
      onUpdate({ include: [...stage.include, fieldName] })
    } else {
      onUpdate({ include: stage.include.filter((f) => f !== fieldName) })
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground">Campos a incluir</Label>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">Execute um stage anterior para ver os campos</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {fields.map((f) => {
            const checked = stage.include.includes(f.name)
            return (
              <div key={f.name} className="flex items-center gap-2">
                <Checkbox
                  id={`proj-${stage.id}-${f.name}`}
                  checked={checked}
                  onCheckedChange={(v) => toggleField(f.name, v === true)}
                  className="size-3.5"
                />
                <label
                  htmlFor={`proj-${stage.id}-${f.name}`}
                  className="cursor-pointer truncate text-xs"
                >
                  {f.name}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
