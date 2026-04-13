import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { ComponentType, ChartDisplayConfig } from '@/types'

const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#a855f7',
]

interface Props {
  type: ComponentType
  data: Record<string, unknown>[]
  xField?: string
  yFields?: string[]
  config: ChartDisplayConfig
  onChange: (config: ChartDisplayConfig) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="space-y-3 pb-2 pl-4">{children}</div>}
    </div>
  )
}

export function ChartOptionsPanel({ type, data, xField, yFields, config, onChange }: Props) {
  const update = (patch: Partial<ChartDisplayConfig>) => onChange({ ...config, ...patch })
  const colors = config.colors?.length ? config.colors : DEFAULT_COLORS

  const showAxes = type === 'BAR_CHART' || type === 'LINE_CHART'
  const showPieOptions = type === 'PIE_CHART'
  const showDataLabelsOption = type === 'BAR_CHART' || type === 'LINE_CHART'
  const showLegendOption = type === 'BAR_CHART' || type === 'LINE_CHART' || type === 'PIE_CHART'

  const pieCategories =
    showPieOptions && xField && data.length > 0
      ? data.slice(0, 10).map((row, i) => ({
          label: String(row[xField] ?? `Fatia ${i + 1}`),
          index: i,
        }))
      : []

  return (
    <div className="space-y-1">
      <Separator />
      <div className="space-y-2 pt-1">
        <Label className="text-xs text-muted-foreground">Aparência</Label>

        {/* Colors */}
        <Section title="Cores">
          {(type === 'BAR_CHART' || type === 'LINE_CHART') && yFields && yFields.length > 1 ? (
            <div className="space-y-2">
              {yFields.map((field, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Label className="flex-1 truncate text-xs" title={field}>{field}</Label>
                  <input
                    type="color"
                    value={colors[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                    onChange={(e) => {
                      const next = [...colors]
                      while (next.length <= i) next.push(DEFAULT_COLORS[next.length % DEFAULT_COLORS.length]!)
                      next[i] = e.target.value
                      update({ colors: next })
                    }}
                    className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                </div>
              ))}
            </div>
          ) : (type === 'BAR_CHART' || type === 'LINE_CHART' || type === 'KPI' || type === 'PROGRESS_BAR' || type === 'GAUGE') ? (
            <div className="flex items-center justify-between">
              <Label className="text-xs">Cor principal</Label>
              <input
                type="color"
                value={colors[0] ?? '#3b82f6'}
                onChange={(e) => {
                  const next = [...colors]
                  next[0] = e.target.value
                  update({ colors: next })
                }}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
            </div>
          ) : null}

          {showPieOptions && (
            <>
              {pieCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Execute a query para editar cores por fatia
                </p>
              ) : (
                <div className="space-y-2">
                  {pieCategories.map(({ label, index }) => (
                    <div key={index} className="flex items-center gap-2">
                      <Label className="flex-1 truncate text-xs" title={label}>
                        {label}
                      </Label>
                      <input
                        type="color"
                        value={
                          colors[index] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                        }
                        onChange={(e) => {
                          const next = [...colors]
                          while (next.length <= index)
                            next.push(DEFAULT_COLORS[next.length % DEFAULT_COLORS.length]!)
                          next[index] = e.target.value
                          update({ colors: next })
                        }}
                        className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      />
                    </div>
                  ))}
                  {data.length > 10 && (
                    <p className="text-[11px] text-muted-foreground">
                      +{data.length - 10} fatias com cores padrão
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Section>

        {/* Axes */}
        {showAxes && (
          <Section title="Eixos">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Eixo X
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-x-label" className="cursor-pointer text-xs">
                  Mostrar rótulo
                </Label>
                <Switch
                  id="show-x-label"
                  checked={config.showXLabel !== false}
                  onCheckedChange={(v) => update({ showXLabel: v })}
                />
              </div>
              {config.showXLabel !== false && (
                <Input
                  className="h-7 text-xs"
                  value={config.xAxisLabel ?? ''}
                  onChange={(e) => update({ xAxisLabel: e.target.value || undefined })}
                  placeholder={xField ?? 'Rótulo do eixo X'}
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Eixo Y
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-y-label" className="cursor-pointer text-xs">
                  Mostrar rótulo
                </Label>
                <Switch
                  id="show-y-label"
                  checked={config.showYLabel !== false}
                  onCheckedChange={(v) => update({ showYLabel: v })}
                />
              </div>
              {config.showYLabel !== false && (
                <Input
                  className="h-7 text-xs"
                  value={config.yAxisLabel ?? ''}
                  onChange={(e) => update({ yAxisLabel: e.target.value || undefined })}
                  placeholder="Rótulo do eixo Y"
                />
              )}
            </div>
          </Section>
        )}

        {/* KPI */}
        {type === 'KPI' && (
          <Section title="Valor">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Prefixo</Label>
                <Input
                  className="h-7 text-xs"
                  value={config.prefix ?? ''}
                  onChange={(e) => update({ prefix: e.target.value || undefined })}
                  placeholder="R$"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Sufixo</Label>
                <Input
                  className="h-7 text-xs"
                  value={config.suffix ?? ''}
                  onChange={(e) => update({ suffix: e.target.value || undefined })}
                  placeholder="%"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="compact-num" className="cursor-pointer text-xs">
                Formato compacto (1K, 1M)
              </Label>
              <Switch
                id="compact-num"
                checked={config.compact === true}
                onCheckedChange={(v) => update({ compact: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
                <span className="text-xs text-muted-foreground">{config.fontSize ?? 36}px</span>
              </div>
              <input
                type="range"
                min={20}
                max={96}
                step={2}
                value={config.fontSize ?? 36}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Posição do label</Label>
              <Select
                value={config.labelPosition ?? 'bottom'}
                onValueChange={(v) =>
                  update({ labelPosition: v as ChartDisplayConfig['labelPosition'] })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Abaixo do valor</SelectItem>
                  <SelectItem value="top">Acima do valor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>
        )}

        {/* PROGRESS_BAR */}
        {type === 'PROGRESS_BAR' && (
          <Section title="Barra de progresso">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-values" className="cursor-pointer text-xs">
                Mostrar valores (atual / meta)
              </Label>
              <Switch
                id="show-values"
                checked={config.showValues !== false}
                onCheckedChange={(v) => update({ showValues: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-percentage" className="cursor-pointer text-xs">
                Mostrar porcentagem
              </Label>
              <Switch
                id="show-percentage"
                checked={config.showPercentage !== false}
                onCheckedChange={(v) => update({ showPercentage: v })}
              />
            </div>

            {config.showPercentage !== false && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Label da porcentagem</Label>
                <Input
                  className="h-7 text-xs"
                  value={config.percentageLabel ?? ''}
                  onChange={(e) => update({ percentageLabel: e.target.value || undefined })}
                  placeholder="Atingimento percentual"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="title-bold" className="cursor-pointer text-xs">
                Título em negrito
              </Label>
              <Switch
                id="title-bold"
                checked={config.titleBold !== false}
                onCheckedChange={(v) => update({ titleBold: v })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tamanho da fonte do label</Label>
                <span className="text-xs text-muted-foreground">{config.labelFontSize ?? 14}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={48}
                step={1}
                value={config.labelFontSize ?? 14}
                onChange={(e) => update({ labelFontSize: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Altura da barra</Label>
                <span className="text-xs text-muted-foreground">{config.barHeight ?? 8}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={32}
                step={2}
                value={config.barHeight ?? 8}
                onChange={(e) => update({ barHeight: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Cor de fundo da barra</Label>
              <input
                type="color"
                value={config.barBackgroundColor ?? '#e5e7eb'}
                onChange={(e) => update({ barBackgroundColor: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
            </div>
          </Section>
        )}

        {/* GAUGE */}
        {type === 'GAUGE' && (
          <Section title="Gauge">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-gauge-value" className="cursor-pointer text-xs">
                Exibir valor no centro
              </Label>
              <Switch
                id="show-gauge-value"
                checked={config.showGaugeValue !== false}
                onCheckedChange={(v) => update({ showGaugeValue: v })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor mínimo</Label>
              <Input
                className="h-7 text-xs"
                type="number"
                value={config.gaugeMin ?? 0}
                onChange={(e) => update({ gaugeMin: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </Section>
        )}

        {/* Display */}
        <Section title="Exibição">
          {showAxes && (
            <div className="flex items-center justify-between">
              <Label htmlFor="show-grid" className="cursor-pointer text-xs">
                Linhas de grade
              </Label>
              <Switch
                id="show-grid"
                checked={config.showGrid !== false}
                onCheckedChange={(v) => update({ showGrid: v })}
              />
            </div>
          )}

          {showLegendOption && (
            <div className="flex items-center justify-between">
              <Label htmlFor="show-legend" className="cursor-pointer text-xs">
                Mostrar legenda
              </Label>
              <Switch
                id="show-legend"
                checked={
                  type === 'PIE_CHART'
                    ? config.showLegend !== false
                    : config.showLegend === true
                }
                onCheckedChange={(v) => update({ showLegend: v })}
              />
            </div>
          )}

          {type === 'BAR_CHART' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="bar-horizontal" className="cursor-pointer text-xs">
                Barras horizontais
              </Label>
              <Switch
                id="bar-horizontal"
                checked={config.barLayout === 'horizontal'}
                onCheckedChange={(v) => update({ barLayout: v ? 'horizontal' : 'vertical' })}
              />
            </div>
          )}

          {showDataLabelsOption && (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-data-labels" className="cursor-pointer text-xs">
                  Labels de dados
                </Label>
                <Switch
                  id="show-data-labels"
                  checked={config.showDataLabels === true}
                  onCheckedChange={(v) => update({ showDataLabels: v })}
                />
              </div>
              {config.showDataLabels === true && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Tamanho labels</Label>
                    <span className="text-xs text-muted-foreground">{config.dataLabelFontSize ?? 10}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={24}
                    step={1}
                    value={config.dataLabelFontSize ?? 10}
                    onChange={(e) => update({ dataLabelFontSize: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </>
          )}

          {showAxes && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Tamanho fonte eixos</Label>
                  <span className="text-xs text-muted-foreground">{config.tickFontSize ?? 11}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={config.tickFontSize ?? 11}
                  onChange={(e) => update({ tickFontSize: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cor da fonte</Label>
                <input
                  type="color"
                  value={config.fontColor ?? '#888888'}
                  onChange={(e) => update({ fontColor: e.target.value })}
                  className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </div>
            </>
          )}

          {showPieOptions && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label das fatias</Label>
                <Select
                  value={config.labelType ?? 'percentage'}
                  onValueChange={(v) =>
                    update({ labelType: v as ChartDisplayConfig['labelType'] })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="value">Valor</SelectItem>
                    <SelectItem value="name">Nome</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="donut-mode" className="cursor-pointer text-xs">
                  Modo donut
                </Label>
                <Switch
                  id="donut-mode"
                  checked={(config.innerRadius ?? 0) > 0}
                  onCheckedChange={(v) => update({ innerRadius: v ? 60 : 0 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pie-legend-with-value" className="cursor-pointer text-xs">
                  Valor da fatia na legenda
                </Label>
                <Switch
                  id="pie-legend-with-value"
                  checked={config.appendPieLabelToLegend === true}
                  onCheckedChange={(v) => update({ appendPieLabelToLegend: v })}
                />
              </div>
            </>
          )}
        </Section>
      </div>
    </div>
  )
}
