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
} from 'recharts'
import type { ComponentType } from '@/types'
import { ResultsTable } from '@/components/question-editor/ResultsTable'

interface Props {
  type: ComponentType
  data: Record<string, unknown>[]
  configuration: Record<string, unknown>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function ChartRenderer({ type, data, configuration }: Props) {
  if (!data || data.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data</div>
  }

  const xField = (configuration['xField'] as string) ?? Object.keys(data[0]!)[0] ?? '_id'
  const yField = (configuration['yField'] as string) ?? Object.keys(data[0]!)[1] ?? 'value'
  const colors = (configuration['colors'] as string[]) ?? COLORS

  if (type === 'KPI') {
    const value = data[0]?.[yField]
    const label = (configuration['label'] as string) ?? yField
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-4xl font-bold">{typeof value === 'number' ? value.toLocaleString() : String(value ?? '-')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    )
  }

  if (type === 'TABLE') {
    return <ResultsTable data={data} />
  }

  if (type === 'PIE_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={yField} nameKey={xField} cx="50%" cy="50%" outerRadius="70%">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'LINE_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xField} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey={yField} stroke={colors[0]} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // BAR_CHART (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xField} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey={yField} fill={colors[0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
