import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

interface Props {
  type: ComponentType
  data: Record<string, unknown>[]
  configuration: Record<string, unknown>
  title?: string
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

export function ChartRenderer({ type, data, configuration, title }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    )
  }

  const xField = (configuration['xField'] as string) ?? Object.keys(data[0]!)[0] ?? '_id'
  const yField = (configuration['yField'] as string) ?? Object.keys(data[0]!)[1] ?? 'value'
  const display = (configuration['display'] as ChartDisplayConfig | undefined) ?? {}
  const colors = display.colors?.length ? display.colors : DEFAULT_COLORS
  const primaryColor = colors[0] ?? DEFAULT_COLORS[0]!

  const showGrid = display.showGrid !== false
  // PIE default true, BAR/LINE default false (single series — legend only adds noise)
  const showLegend =
    type === 'PIE_CHART' ? display.showLegend !== false : display.showLegend === true
  const showDataLabels = display.showDataLabels === true
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

  if (type === 'TABLE') {
    const columnAliases = (configuration['columnAliases'] as Record<string, string>) ?? undefined
    const columnOrder = (configuration['columnOrder'] as string[]) ?? undefined
    return (
      <ResultsTable
        data={data}
        columnAliases={columnAliases}
        columnOrder={columnOrder}
        exportFilename={title}
      />
    )
  }

  const xAxisLabel = showXLabel && display.xAxisLabel ? display.xAxisLabel : undefined
  const yAxisLabel = showYLabel && display.yAxisLabel ? display.yAxisLabel : undefined

  const xAxisProps = {
    dataKey: xField,
    tick: { fontSize: 11 },
    interval: 0 as const,
    minTickGap: 0,
    tickMargin: 8,
    tickFormatter: formatXAxisTick,
    ...(xAxisLabel
      ? {
          label: { value: xAxisLabel, position: 'insideBottom' as const, offset: -8, fontSize: 11 },
          height: 48,
        }
      : {}),
  }

  const yAxisProps = {
    tick: { fontSize: 11 },
    ...(yAxisLabel
      ? {
          label: {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft' as const,
            offset: 10,
            fontSize: 11,
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
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip />
          {showLegend && <Legend />}
          <Line type="monotone" dataKey={yField} stroke={primaryColor} dot={false}>
            {showDataLabels && (
              <LabelList dataKey={yField} position="top" style={{ fontSize: 10 }} />
            )}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // BAR_CHART (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip />
        {showLegend && <Legend />}
        <Bar dataKey={yField} fill={primaryColor}>
          {showDataLabels && (
            <LabelList dataKey={yField} position="top" style={{ fontSize: 10 }} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
