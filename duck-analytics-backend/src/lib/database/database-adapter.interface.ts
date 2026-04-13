import type {
  FieldSchema,
  QueryConfigurationAny,
  QueryFilter,
  PipelineConfiguration,
} from '../../modules/queries/query-builder.service';

export interface DatabaseAdapter {
  testConnection(encryptedConnStr: string, database: string): Promise<void>;

  testRawConnection(connStr: string, database: string): Promise<void>;

  listCollections(
    encryptedConnStr: string,
    database: string,
  ): Promise<string[]>;

  inferSchema(
    encryptedConnStr: string,
    database: string,
    collection: string,
  ): Promise<FieldSchema[]>;

  execute(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
    injectedFilters?: QueryFilter[],
  ): Promise<{ data: Record<string, unknown>[]; count: number }>;

  executePartial(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: PipelineConfiguration,
    upToStageId: string,
  ): Promise<{
    data: Record<string, unknown>[];
    count: number;
    inferredFields: FieldSchema[];
  }>;

  preview(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
  ): Promise<{ data: Record<string, unknown>[]; count: number }>;

  getDistinctValues(
    encryptedConnStr: string,
    database: string,
    collection: string,
    field: string,
    matchFilters?: { field: string; value: unknown; operator: string }[],
    search?: string,
    skip?: number,
    limit?: number,
  ): Promise<{ items: { label: string; value: unknown }[]; total: number }>;

  translateValues(
    encryptedConnStr: string,
    database: string,
    collection: string,
    sourceField: string,
    targetField: string,
    sourceValues: unknown[],
  ): Promise<unknown[]>;
}
