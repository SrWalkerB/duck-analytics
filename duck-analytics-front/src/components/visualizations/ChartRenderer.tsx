import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import type { ComponentType, ChartDisplayConfig } from '@/types'
import { ResultsTable } from '@/components/question-editor/ResultsTable'
import { cn } from '@/lib/utils'

interface Props {
  type: ComponentType
  data: Record<string, unknown>[]
  configuration: Record<string, unknown>
  title?: string
  /** When true, table viz shows the "Colunas" edit dropdown. Default: false (dashboard/read-only). */
  editable?: boolean
}

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

type PieLabelProps = {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  value?: unknown
  name?: unknown
}

const MAX_X_TICK_LENGTH = 16

function formatXAxisTick(value: unknown) {
  const text = String(value ?? '')
  if (text.length <= MAX_X_TICK_LENGTH) return text
  return `${text.slice(0, MAX_X_TICK_LENGTH - 3)}...`
}

function formatPieLabelValue(
  labelType: NonNullable<ChartDisplayConfig['labelType']>,
  value: unknown,
  name: unknown,
  total: number,
) {
  if (labelType === 'none') return ''
  if (labelType === 'name') return String(name ?? '')
  if (labelType === 'value') {
    return typeof value === 'number' ? value.toLocaleString() : String(value ?? '')
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!isFinite(numeric) || !total) return '0%'
  return `${((numeric / total) * 100).toFixed(0)}%`
}

export function ChartRenderer({ type, data, configuration, title, editable = false }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    )
  }

  const xField = (configuration['xField'] as string) ?? Object.keys(data[0]!)[0] ?? '_id'
  const rawYFields = configuration['yFields'] as string[] | undefined
  const yFieldSingle = (configuration['yField'] as string) ?? Object.keys(data[0]!)[1] ?? 'value'
  const yFields: string[] = rawYFields?.length ? rawYFields : [yFieldSingle]
  const yField = yFields[0]!
  const display = (configuration['display'] as ChartDisplayConfig | undefined) ?? {}
  const colors = display.colors?.length ? display.colors : DEFAULT_COLORS
  const primaryColor = colors[0] ?? DEFAULT_COLORS[0]!

  const isMultiSeries = yFields.length > 1
  const showGrid = display.showGrid !== false
  const showLegend =
    type === 'PIE_CHART'
      ? display.showLegend !== false
      : isMultiSeries
        ? display.showLegend !== false
        : display.showLegend === true
  const showDataLabels = display.showDataLabels === true
  const dataLabelFontSize = display.dataLabelFontSize ?? 10
  const tickFontSize = display.tickFontSize ?? 11
  const fontColor = display.fontColor ?? undefined
  const showXLabel = display.showXLabel !== false
  const showYLabel = display.showYLabel !== false

  if (type === 'KPI') {
    const value = data[0]?.[yField]
    const label = (configuration['label'] as string) ?? yField
    const prefix = display.prefix ?? ''
    const suffix = display.suffix ?? ''

    let formatted: string
    if (typeof value === 'number') {
      if (display.compact) {
        formatted =
          value >= 1_000_000
            ? `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
            : value >= 1_000
              ? `${(value / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`
              : value.toLocaleString()
      } else {
        formatted = value.toLocaleString()
      }
    } else {
      formatted = String(value ?? '-')
    }

    const fontSize = display.fontSize ?? 36
    const labelEl = <p className="text-sm text-muted-foreground">{label}</p>
    const valueEl = (
      <p className="font-bold" style={{ color: primaryColor, fontSize }}>
        {prefix}{formatted}{suffix}
      </p>
    )
    const labelOnTop = display.labelPosition === 'top'

    return (
      <div className="flex h-full flex-col items-center justify-center gap-1">
        {labelOnTop ? labelEl : null}
        {valueEl}
        {!labelOnTop ? labelEl : null}
      </div>
    )
  }

  if (type === 'PROGRESS_BAR') {
    const currentValue = Number(data[0]?.[yField] ?? 0)
    const goalFieldName = configuration['goalField'] as string | undefined
    const goalFixed = configuration['goalValue'] as number | undefined
    const goal = goalFieldName
      ? Number(data[0]?.[goalFieldName] ?? 0)
      : (goalFixed ?? 100)
    const label = (configuration['label'] as string) ?? yField

    const showValues = display.showValues !== false
    const showPercentage = display.showPercentage !== false
    const percentageLabel = display.percentageLabel ?? 'Atingimento percentual'
    const barColor = colors[0] ?? '#3b82f6'
    const barBg = display.barBackgroundColor ?? '#e5e7eb'
    const barHeight = display.barHeight ?? 8
    const titleBold = display.titleBold !== false
    const labelFontSize = display.labelFontSize ?? 14

    const percentage = goal > 0 ? (currentValue / goal) * 100 : 0
    const clampedPercent = Math.min(percentage, 100)

    const formatNum = (n: number) =>
      n % 1 === 0
        ? n.toLocaleString()
        : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return (
      <div className="flex h-full flex-col justify-center gap-2 px-4">
        <div className="flex items-baseline justify-between">
          <span className={cn(titleBold && 'font-bold')} style={{ fontSize: labelFontSize }}>{label}</span>
          {showValues && (
            <span className="text-sm">
              <span className="font-semibold" style={{ fontSize: '1.25rem' }}>
                {formatNum(currentValue)}
              </span>
              <span className="text-muted-foreground"> / {formatNum(goal)}</span>
            </span>
          )}
        </div>

        <div
          className="w-full overflow-hidden rounded-full"
          style={{ height: barHeight, backgroundColor: barBg }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${clampedPercent}%`, backgroundColor: barColor }}
          />
        </div>

        {showPercentage && (
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>{percentageLabel}</span>
            <span>{percentage.toFixed(2)}%</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'GAUGE') {
    const currentValue = Number(data[0]?.[yField] ?? 0)
    const goalFieldName = configuration['goalField'] as string | undefined
    const goalFixed = configuration['goalValue'] as number | undefined
    const goal = goalFieldName
      ? Number(data[0]?.[goalFieldName] ?? 0)
      : (goalFixed ?? 100)
    const label = (configuration['label'] as string) ?? yField
    const gaugeColor = colors[0] ?? '#3b82f6'
    const showValue = display.showGaugeValue !== false
    const minValue = display.gaugeMin ?? 0

    const percentage = goal - minValue > 0
      ? (currentValue - minValue) / (goal - minValue)
      : 0
    const clampedPercent = Math.max(0, Math.min(percentage, 1))

    const formatNum = (n: number) =>
      n % 1 === 0
        ? n.toLocaleString()
        : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // SVG arc math
    const cx = 150
    const cy = 130
    const r = 100
    const strokeWidth = 14
    const startAngle = Math.PI
    const endAngle = 0

    const bgStartX = cx + r * Math.cos(startAngle)
    const bgStartY = cy - r * Math.sin(startAngle)
    const bgEndX = cx + r * Math.cos(endAngle)
    const bgEndY = cy - r * Math.sin(endAngle)
    const bgPath = `M ${bgStartX} ${bgStartY} A ${r} ${r} 0 0 1 ${bgEndX} ${bgEndY}`

    const fillAngle = Math.PI - clampedPercent * Math.PI
    const fillEndX = cx + r * Math.cos(fillAngle)
    const fillEndY = cy - r * Math.sin(fillAngle)
    const largeArc = clampedPercent > 0.5 ? 1 : 0
    const fillPath = clampedPercent > 0
      ? `M ${bgStartX} ${bgStartY} A ${r} ${r} 0 ${largeArc} 1 ${fillEndX} ${fillEndY}`
      : ''

    return (
      <div className="flex h-full flex-col items-center justify-center gap-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <svg viewBox="0 0 300 170" width="100%" style={{ maxWidth: 280, maxHeight: 160 }}>
          {/* Background arc */}
          <path
            d={bgPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}
          {/* Center value */}
          {showValue && (
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={32}
              fontWeight={700}
              fill="currentColor"
            >
              {formatNum(currentValue)}
            </text>
          )}
          {/* Min label */}
          <text
            x={bgStartX}
            y={cy + 22}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            opacity={0.5}
          >
            {formatNum(minValue)}
          </text>
          {/* Max label */}
          <text
            x={bgEndX}
            y={cy + 22}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            opacity={0.5}
          >
            {formatNum(goal)}
          </text>
        </svg>
      </div>
    )
  }

  if (type === 'TABLE') {
    const columnAliases = (configuration['columnAliases'] as Record<string, string>) ?? undefined
    const columnOrder = (configuration['columnOrder'] as string[]) ?? undefined
    const paginationMode = (configuration['paginationMode'] as 'infinite' | 'paginated') ?? 'paginated'
    const pageSize = (configuration['pageSize'] as number) ?? 100
    const exportFormats = (configuration['exportFormats'] as Array<'csv' | 'excel'>) ?? ['csv', 'excel']
    const columnFormats = configuration['columnFormats'] as
      | Record<string, import('@/lib/column-format').ColumnFormat>
      | undefined
    return (
      <ResultsTable
        data={data}
        columnAliases={columnAliases}
        columnOrder={columnOrder}
        exportFilename={title}
        editable={editable}
        paginationMode={paginationMode}
        pageSize={pageSize}
        exportFormats={exportFormats}
        columnFormats={columnFormats}
      />
    )
  }

  const xAxisLabel = showXLabel && display.xAxisLabel ? display.xAxisLabel : undefined
  const yAxisLabel = showYLabel && display.yAxisLabel ? display.yAxisLabel : undefined

  const tickStyle = { fontSize: tickFontSize, ...(fontColor ? { fill: fontColor } : {}) }

  const xAxisProps = {
    dataKey: xField,
    tick: tickStyle,
    interval: 0 as const,
    minTickGap: 0,
    tickMargin: 8,
    tickFormatter: formatXAxisTick,
    ...(xAxisLabel
      ? {
          label: { value: xAxisLabel, position: 'insideBottom' as const, offset: -8, fontSize: tickFontSize, ...(fontColor ? { fill: fontColor } : {}) },
          height: 48,
        }
      : {}),
  }

  const yAxisProps = {
    tick: tickStyle,
    ...(yAxisLabel
      ? {
          label: {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft' as const,
            offset: 10,
            fontSize: tickFontSize,
            ...(fontColor ? { fill: fontColor } : {}),
          },
          width: 64,
        }
      : {}),
  }

  if (type === 'PIE_CHART') {
    const innerRadius = display.innerRadius ?? 0
    const labelType = display.labelType ?? 'percentage'
    const appendPieLabelToLegend = display.appendPieLabelToLegend === true
    const hasManySlices = data.length > 4
    const effectiveLabelType = hasManySlices ? 'percentage' : labelType
    const outerRadius = hasManySlices ? '52%' : '62%'
    const pieCenterY = showLegend ? '44%' : '50%'
    const pieTotal = data.reduce((acc, row) => {
      const n = row[yField]
      const asNumber = typeof n === 'number' ? n : Number(n)
      return isFinite(asNumber) ? acc + asNumber : acc
    }, 0)

    const pieLegendMeta = new Map<string, string>()
    for (const row of data) {
      const name = String(row[xField] ?? '')
      const suffix = formatPieLabelValue(labelType, row[yField], row[xField], pieTotal)
      if (suffix) pieLegendMeta.set(name, suffix)
    }

    const renderCompactLabel = ({
      cx = 0,
      cy = 0,
      midAngle = 0,
      innerRadius = 0,
      outerRadius = 0,
      percent = 0,
    }: PieLabelProps) => {
      if (percent < 0.08) return null
      const RADIAN = Math.PI / 180
      const radius = innerRadius + (outerRadius - innerRadius) * 0.55
      const x = cx + radius * Math.cos(-midAngle * RADIAN)
      const y = cy + radius * Math.sin(-midAngle * RADIAN)

      return (
        <text
          x={x}
          y={y}
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
        >
          {(percent * 100).toFixed(0)}%
        </text>
      )
    }

    const renderLabel = ({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0, value, name, index }: PieLabelProps & { index?: number }) => {
      if (labelType === 'none' || percent < 0.005) return null
      const RADIAN = Math.PI / 180
      const angle = -midAngle * RADIAN

      // Alternate line length for small slices so adjacent labels don't overlap
      const isSmall = percent < 0.05
      const offset = isSmall && typeof index === 'number' && index % 2 === 1 ? 30 : 0
      const lineLen = 58 + offset

      const lineStartX = cx + (outerRadius + 4) * Math.cos(angle)
      const lineStartY = cy + (outerRadius + 4) * Math.sin(angle)
      const lineEndX = cx + (outerRadius + lineLen) * Math.cos(angle)
      const lineEndY = cy + (outerRadius + lineLen) * Math.sin(angle)
      const labelX = cx + (outerRadius + lineLen + 8) * Math.cos(angle)
      const labelY = cy + (outerRadius + lineLen + 8) * Math.sin(angle)

      let text = ''
      if (labelType === 'percentage') text = `${(percent * 100).toFixed(0)}%`
      else if (labelType === 'value')
        text = typeof value === 'number' ? value.toLocaleString() : String(value)
      else if (labelType === 'name') text = String(name)

      if (!text) return null

      return (
        <g>
          <line
            x1={lineStartX}
            y1={lineStartY}
            x2={lineEndX}
            y2={lineEndY}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.4}
          />
          <text
            x={labelX}
            y={labelY}
            fill="currentColor"
            textAnchor={labelX > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={11}
          >
            {text}
          </text>
        </g>
      )
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            dataKey={yField}
            nameKey={xField}
            cx="50%"
            cy={pieCenterY}
            outerRadius={outerRadius}
            innerRadius={innerRadius > 0 ? `${innerRadius}%` : 0}
            labelLine={false}
            label={
              effectiveLabelType === 'none'
                ? undefined
                : hasManySlices
                  ? renderCompactLabel
                  : renderLabel
            }
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? value.toLocaleString() : value,
              name,
            ]}
          />
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconSize={10}
              wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
              formatter={(value) => {
                const base = String(value ?? '')
                if (!appendPieLabelToLegend) return base
                const suffix = pieLegendMeta.get(base)
                if (!suffix) return base
                return `${base} (${suffix})`
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'LINE_CHART') {
    const showAreaFill = display.showAreaFill !== false
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {showAreaFill && (
            <defs>
              {yFields.map((field, i) => {
                const color = colors[i % colors.length] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]!
                return (
                  <linearGradient key={`gradient-${field}`} id={`areaGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                )
              })}
            </defs>
          )}
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip />
          {showLegend && <Legend />}
          {showAreaFill && yFields.map((_, i) => (
            <Area
              key={`area-${i}`}
              type="monotone"
              dataKey={yFields[i]!}
              fill={`url(#areaGradient-${i})`}
              stroke="none"
            />
          ))}
          {yFields.map((field, i) => (
            <Line key={field} type="monotone" dataKey={field} stroke={colors[i % colors.length]} dot={false}>
              {showDataLabels && (
                <LabelList dataKey={field} position="top" style={{ fontSize: dataLabelFontSize, ...(fontColor ? { fill: fontColor } : {}) }} />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // BAR_CHART (default)
  const horizontal = display.barLayout === 'horizontal'

  if (horizontal) {
    const maxLabelLen = Math.max(...data.map((row) => String(row[xField] ?? '').length))
    const yAxisWidth = Math.min(Math.max(maxLabelLen * 7, 60), 220)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis type="number" tick={tickStyle} />
          <YAxis
            type="category"
            dataKey={xField}
            tick={tickStyle}
            width={yAxisWidth}
            tickFormatter={formatXAxisTick}
          />
          <Tooltip />
          {showLegend && <Legend />}
          {yFields.map((field, i) => (
            <Bar key={field} dataKey={field} fill={colors[i % colors.length]}>
              {showDataLabels && (
                <LabelList dataKey={field} position="right" style={{ fontSize: dataLabelFontSize, ...(fontColor ? { fill: fontColor } : {}) }} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip />
        {showLegend && <Legend />}
        {yFields.map((field, i) => (
          <Bar key={field} dataKey={field} fill={colors[i % colors.length]}>
            {showDataLabels && (
              <LabelList dataKey={field} position="top" style={{ fontSize: dataLabelFontSize, ...(fontColor ? { fill: fontColor } : {}) }} />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
