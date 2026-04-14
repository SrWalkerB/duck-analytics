export type SupportedLocale = 'pt-BR' | 'en' | 'es'

export interface User {
  id: string
  email: string
  name: string
  locale: SupportedLocale
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
    locale: SupportedLocale
  }
}

export interface DataSource {
  id: string
  name: string
  type: 'MONGODB' | 'POSTGRESQL'
  database: string
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export type ComponentType = 'TABLE' | 'BAR_CHART' | 'LINE_CHART' | 'PIE_CHART' | 'KPI' | 'PROGRESS_BAR' | 'GAUGE'
export type FilterType = 'SELECT' | 'MULTI_SELECT' | 'DATE_RANGE' | 'TEXT'
export type DashboardStatus = 'DRAFT' | 'PUBLISHED'
export type EmbedType = 'PUBLIC' | 'JWT_SECURED'
export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

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
  _foreignFields?: FieldSchema[]
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
  dataLabelFontSize?: number
  tickFontSize?: number
  fontColor?: string
  barLayout?: 'vertical' | 'horizontal'
  innerRadius?: number
  labelType?: 'value' | 'percentage' | 'name' | 'none'
  appendPieLabelToLegend?: boolean
  // KPI specific
  prefix?: string
  suffix?: string
  compact?: boolean
  labelPosition?: 'top' | 'bottom'
  fontSize?: number
  // PROGRESS_BAR specific
  showValues?: boolean
  showPercentage?: boolean
  percentageLabel?: string
  barHeight?: number
  titleBold?: boolean
  labelFontSize?: number
  barBackgroundColor?: string
  // GAUGE specific
  showGaugeValue?: boolean
  gaugeMin?: number
  // LINE_CHART specific
  showAreaFill?: boolean
}

export interface Component {
  id: string
  name: string
  type: ComponentType
  queryId: string
  configuration: Record<string, unknown>
  userId: string
  folderId: string | null
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
  valueField?: string
  fieldType?: string
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
  queryId: string | null
}

export interface DashboardEmbed {
  id: string
  embedCode: string
  embedType: EmbedType
  showFilters: boolean
  showTitle: boolean
  createdAt: string
  updatedAt: string
}

export interface Dashboard {
  id: string
  name: string
  description: string | null
  configuration: Record<string, unknown>
  status: DashboardStatus
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
  dashboardComponents: DashboardComponent[]
  dashboardFilters: DashboardFilter[]
  embed?: DashboardEmbed | null
}

export interface SystemLog {
  id: string
  userId: string
  level: LogLevel
  source: string
  event: string
  resourceId: string | null
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface FieldSchema {
  name: string
  type: string
  nested?: FieldSchema[]
}

export interface MatchableField {
  name: string
  type: string
  origin: 'base' | 'lookup' | 'group'
  stageLabel?: string
}

export interface FilterRelationship {
  id: string
  sourceFilterId: string
  targetFilterId: string
  sourceField: string
  targetField: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  updatedAt: string
  children: Folder[]
}

export interface CollectionItem {
  id: string
  name: string
  type: 'folder' | 'dashboard' | 'component'
  itemType?: ComponentType
  updatedAt: string
  folderId: string | null
}

export interface CollectionContents {
  folder: Folder | null
  breadcrumbs: { id: string; name: string }[]
  items: CollectionItem[]
}

export interface FolderTreeNode {
  id: string
  name: string
  parentId: string | null
  children: FolderTreeNode[]
}

export interface AIConfig {
  provider: string
  model: string
  createdAt: string
  updatedAt: string
}
