import { useState, useCallback, useMemo } from 'react'
import type { PipelineStage, PipelineConfiguration } from '@/types'

function generateId(): string {
  return crypto.randomUUID()
}

function createDefaultStage(type: PipelineStage['type']): PipelineStage {
  const base = { id: generateId(), enabled: true }
  switch (type) {
    case '$match':
      return { ...base, type, filters: [] }
    case '$lookup':
      return { ...base, type, from: '', localField: '', foreignField: '_id', as: '', unwind: false }
    case '$group':
      return { ...base, type, groupBy: [], aggregations: [] }
    case '$sort':
      return { ...base, type, sort: [] }
    case '$limit':
      return { ...base, type, limit: 1000 }
    case '$project':
      return { ...base, type, include: [] }
    case '$unwind':
      return { ...base, type, path: '', preserveNullAndEmptyArrays: true }
  }
}

export function usePipelineState(initial?: PipelineConfiguration) {
  const [stages, setStages] = useState<PipelineStage[]>(initial?.stages ?? [])

  const config = useMemo<PipelineConfiguration>(
    () => ({ version: 2, stages }),
    [stages],
  )

  const addStage = useCallback((type: PipelineStage['type'], afterIndex?: number) => {
    const stage = createDefaultStage(type)
    setStages((prev) => {
      const idx = afterIndex !== undefined ? afterIndex + 1 : prev.length
      const next = [...prev]
      next.splice(idx, 0, stage)
      return next
    })
    return stage.id
  }, [])

  const updateStage = useCallback((id: string, patch: Partial<PipelineStage>) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } as PipelineStage : s)),
    )
  }, [])

  const removeStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const toggleStage = useCallback((id: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    )
  }, [])

  const moveStage = useCallback((fromIndex: number, toIndex: number) => {
    setStages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved!)
      return next
    })
  }, [])

  const setAllStages = useCallback((newStages: PipelineStage[]) => {
    setStages(newStages)
  }, [])

  return {
    stages,
    config,
    addStage,
    updateStage,
    removeStage,
    toggleStage,
    moveStage,
    setAllStages,
  }
}
