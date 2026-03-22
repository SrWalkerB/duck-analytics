export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface DataSource {
  id: string
  name: string
  type: 'MONGODB'
  database: string
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export type ComponentType = 'TABLE' | 'BAR_CHART' | 'LINE_CHART' | 'PIE_CHART' | 'KPI'
export type FilterType = 'SELECT' | 'MULTI_SELECT' | 'DATE_RANGE' | 'TEXT'

export interface Query {
  id: string
  name: string
  dataSourceId: string
  collection: string
  configuration: QueryConfigurationAny
  pipeline: unknown[]
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export interface QueryFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex' | 'exists'
  value: unknown
}

export interface QueryAggregation {
  field: string
  function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
  alias: string
}

export interface QuerySort {
  field: string
  direction: 'asc' | 'desc'
}

export interface QueryLookup {
  from: string
  localField: string
  foreignField: string
  as: string
  unwind?: boolean
}

export interface QueryConfiguration {
  filters?: QueryFilter[]
  aggregations?: QueryAggregation[]
  groupBy?: string[]
  sort?: QuerySort[]
  limit?: number
  projections?: string[]
  lookups?: QueryLookup[]
}

// ── Pipeline Configuration (v2) ──

export interface PipelineStageBase {
  id: string
  enabled: boolean
}

export type MatchStage = PipelineStageBase & {
  type: '$match'
  filters: QueryFilter[]
}

export type LookupStage = PipelineStageBase & {
  type: '$lookup'
  from: string
  localField: string
  foreignField: string
  as: string
  unwind?: boolean
}

export type GroupStage = PipelineStageBase & {
  type: '$group'
  groupBy: string[]
  aggregations: QueryAggregation[]
}

export type SortStage = PipelineStageBase & {
  type: '$sort'
  sort: QuerySort[]
}

export type LimitStage = PipelineStageBase & {
  type: '$limit'
  limit: number
}

export type ProjectStage = PipelineStageBase & {
  type: '$project'
  include: string[]
  exclude?: string[]
}

export type UnwindStage = PipelineStageBase & {
  type: '$unwind'
  path: string
  preserveNullAndEmptyArrays: boolean
}

export type PipelineStage =
  | MatchStage
  | LookupStage
  | GroupStage
  | SortStage
  | LimitStage
  | ProjectStage
  | UnwindStage

export interface PipelineConfiguration {
  version: 2
  stages: PipelineStage[]
}

export type QueryConfigurationAny = QueryConfiguration | PipelineConfiguration

export function isPipelineConfiguration(
  config: unknown,
): config is PipelineConfiguration {
  return (
    typeof config === 'object' &&
    config !== null &&
    (config as PipelineConfiguration).version === 2
  )
}

export interface ChartDisplayConfig {
  colors?: string[]
  xAxisLabel?: string
  yAxisLabel?: string
  showXLabel?: boolean
  showYLabel?: boolean
  showGrid?: boolean
  showLegend?: boolean
  showDataLabels?: boolean
  innerRadius?: number
  labelType?: 'value' | 'percentage' | 'name' | 'none'
  // KPI specific
  prefix?: string
  suffix?: string
  compact?: boolean
  labelPosition?: 'top' | 'bottom'
  fontSize?: number
}

export interface Component {
  id: string
  name: string
  type: ComponentType
  queryId: string
  configuration: Record<string, unknown>
  userId: string
  createdAt: string
  updatedAt: string
  query?: { id: string; collection: string; dataSourceId: string }
}

export interface DashboardTab {
  id: string
  name: string
  order: number
}

export interface DashboardComponent {
  id: string
  dashboardId: string
  componentId: string
  component: Component
  x: number
  y: number
  w: number
  h: number
  title: string | null
  description: string | null
  backgroundColor: string | null
  tabId: string | null
}

export interface FilterTargetMapping {
  componentId: string
  targetField: string
}

export interface DashboardFilter {
  id: string
  dashboardId: string
  label: string
  type: FilterType
  field: string
  collection: string
  dataSourceId: string
  parentFilterId: string | null
  targetMappings: FilterTargetMapping[]
}

export interface Dashboard {
  id: string
  name: string
  description: string | null
  configuration: Record<string, unknown>
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
  dashboardComponents: DashboardComponent[]
  dashboardFilters: DashboardFilter[]
}

export interface FieldSchema {
  name: string
  type: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  children: Folder[]
}

export interface AIConfig {
  provider: string
  model: string
  createdAt: string
  updatedAt: string
}
