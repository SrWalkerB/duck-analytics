import { useState, useCallback } from 'react'
import { GridLayout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard } from '@/types'
import { ChartRenderer } from '@/components/visualizations/ChartRenderer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LayoutChange {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  dashboard: Dashboard
  data: Record<string, { data: Record<string, unknown>[]; count: number }>
  readonly: boolean
  onLayoutChange?: (layout: LayoutChange[]) => void
  onRemoveComponent?: (dcId: string) => void
}

export function DashboardGrid({ dashboard, data, readonly, onLayoutChange, onRemoveComponent }: Props) {
  const [width] = useState(1200)

  const layout: LayoutItem[] = dashboard.dashboardComponents.map((dc) => ({
    i: dc.id,
    x: dc.x,
    y: dc.y,
    w: dc.w,
    h: dc.h,
    static: readonly,
  }))

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      if (readonly || !onLayoutChange) return
      onLayoutChange(
        [...newLayout].map((item) => ({
          id: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      )
    },
    [readonly, onLayoutChange],
  )

  if (!dashboard.dashboardComponents.length) {
    return (
      <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">
        {readonly ? 'No components in this dashboard.' : 'Add components from the panel on the right.'}
      </div>
    )
  }

  return (
    <GridLayout
      layout={layout}
      width={width}
      gridConfig={{ cols: 12, rowHeight: 60 }}
      dragConfig={{ enabled: !readonly }}
      resizeConfig={{ enabled: !readonly }}
      onLayoutChange={handleLayoutChange}
    >
      {dashboard.dashboardComponents.map((dc) => {
        const componentData = data[dc.id]
        const rows = componentData?.data ?? []

        return (
          <div key={dc.id}>
            <Card className="h-full overflow-hidden" style={{ backgroundColor: dc.backgroundColor ?? undefined }}>
              <div className="flex h-8 items-center justify-between border-b px-3">
                <span className="text-xs font-medium truncate">{dc.title ?? dc.component?.name ?? 'Component'}</span>
                {!readonly && onRemoveComponent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveComponent(dc.id)}
                  >
                    ×
                  </Button>
                )}
              </div>
              <div className="h-[calc(100%-2rem)] p-2">
                <ChartRenderer
                  type={dc.component?.type ?? 'TABLE'}
                  data={rows}
                  configuration={(dc.component?.configuration as Record<string, unknown>) ?? {}}
                />
              </div>
            </Card>
          </div>
        )
      })}
    </GridLayout>
  )
}
