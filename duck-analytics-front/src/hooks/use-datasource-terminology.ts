import type { DataSource } from '@/types'

type DataSourceType = DataSource['type']

const STAGE_LABELS: Record<DataSourceType, Record<string, string>> = {
  MONGODB: {
    '$match': 'Filtrar ($match)',
    '$lookup': 'Join ($lookup)',
    '$group': 'Agrupar ($group)',
    '$sort': 'Ordenar ($sort)',
    '$limit': 'Limite ($limit)',
    '$project': 'Projeção ($project)',
    '$unwind': 'Unwind ($unwind)',
  },
  POSTGRESQL: {
    '$match': 'Filtrar (WHERE)',
    '$lookup': 'Join (JOIN)',
    '$group': 'Agrupar (GROUP BY)',
    '$sort': 'Ordenar (ORDER BY)',
    '$limit': 'Limite (LIMIT)',
    '$project': 'Projeção (SELECT)',
    '$unwind': 'Desnormalizar (UNNEST)',
  },
}

export function getDataSourceTerminology(type: DataSourceType = 'MONGODB') {
  return {
    collection: type === 'POSTGRESQL' ? 'Tabela' : 'Collection',
    collectionPlural: type === 'POSTGRESQL' ? 'Tabelas' : 'Collections',
    placeholder: type === 'POSTGRESQL' ? 'Selecione a tabela...' : 'Selecione a collection...',
    connectionPlaceholder: type === 'POSTGRESQL' ? 'postgresql://user:pass@host:5432/db' : 'mongodb://...',
    stageLabels: STAGE_LABELS[type] ?? STAGE_LABELS.MONGODB,
  }
}
