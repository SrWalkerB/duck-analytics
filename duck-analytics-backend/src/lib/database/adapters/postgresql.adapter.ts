import { Injectable } from '@nestjs/common';
import { PostgreSQLService } from '../../postgresql/postgresql.service';
import { PostgreSQLIntrospectionService } from '../../postgresql/postgresql-introspection.service';
import { PostgreSQLQueryCompilerService } from '../../postgresql/postgresql-query-compiler.service';
import type {
  QueryConfigurationAny,
  QueryFilter,
  PipelineConfiguration,
  FieldSchema,
} from '../../../modules/queries/query-builder.service';
import type { DatabaseAdapter } from '../database-adapter.interface';

@Injectable()
export class PostgreSQLAdapter implements DatabaseAdapter {
  constructor(
    private readonly pg: PostgreSQLService,
    private readonly introspection: PostgreSQLIntrospectionService,
    private readonly compiler: PostgreSQLQueryCompilerService,
  ) {}

  async testConnection(
    encryptedConnStr: string,
    database: string,
  ): Promise<void> {
    await this.pg.testConnection(encryptedConnStr, database);
  }

  async testRawConnection(connStr: string, database: string): Promise<void> {
    await this.pg.testRawConnection(connStr, database);
  }

  async listCollections(
    encryptedConnStr: string,
    database: string,
  ): Promise<string[]> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    return this.introspection.listTables(pool);
  }

  async inferSchema(
    encryptedConnStr: string,
    database: string,
    collection: string,
  ): Promise<FieldSchema[]> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    return this.introspection.inferSchema(pool, collection);
  }

  async execute(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
    injectedFilters?: QueryFilter[],
  ): Promise<{ data: Record<string, unknown>[]; count: number }> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    const compiled = this.compiler.compile(config, injectedFilters);
    const sql = this.setBaseTable(compiled, collection);
    const result = await pool.query(sql.text, sql.values);
    const rows = result.rows as Record<string, unknown>[];
    return { data: rows, count: rows.length };
  }

  async executePartial(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: PipelineConfiguration,
    upToStageId: string,
  ): Promise<{
    data: Record<string, unknown>[];
    count: number;
    inferredFields: FieldSchema[];
  }> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    const compiled = this.compiler.compilePartial(config, upToStageId);
    const sql = this.setBaseTable(compiled, collection);
    const result = await pool.query(sql.text, sql.values);
    const rows = result.rows as Record<string, unknown>[];
    const inferredFields = this.inferFieldsFromRows(rows.slice(0, 20));
    return {
      data: rows,
      count: rows.length,
      inferredFields,
    };
  }

  async preview(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
  ): Promise<{ data: Record<string, unknown>[]; count: number }> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    const compiled = this.compiler.compile(config);
    const sql = this.setBaseTable(compiled, collection);
    // Enforce preview limit
    const limited = this.ensureLimit(sql, 1000);
    const result = await pool.query(limited.text, limited.values);
    const rows = result.rows as Record<string, unknown>[];
    return { data: rows, count: rows.length };
  }

  async getDistinctValues(
    encryptedConnStr: string,
    database: string,
    collection: string,
    field: string,
    matchFilters?: { field: string; value: unknown; operator: string }[],
    search?: string,
    skip = 0,
    limit = 50,
  ): Promise<{ items: { label: string; value: unknown }[]; total: number }> {
    const pool = this.pg.getPool(encryptedConnStr, database);
    const table = `"${collection.replace(/"/g, '""')}"`;
    const col = `"${field.replace(/"/g, '""')}"`;

    const conditions: string[] = [`${col} IS NOT NULL`];
    const params: unknown[] = [];

    if (matchFilters) {
      for (const f of matchFilters) {
        const fCol = `"${f.field.replace(/"/g, '""')}"`;
        if (f.operator === 'in') {
          params.push(f.value);
          conditions.push(`${fCol} = ANY($${params.length})`);
        } else {
          params.push(f.value);
          conditions.push(`${fCol} = $${params.length}`);
        }
      }
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`CAST(${col} AS TEXT) ILIKE $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countSql = `SELECT COUNT(DISTINCT ${col}) AS total FROM ${table} ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const firstRow = countResult.rows[0] as { total?: number } | undefined;
    const total = Number(firstRow?.total ?? 0);

    // Paginated values
    const valueSql = `SELECT DISTINCT ${col} AS value FROM ${table} ${whereClause} ORDER BY ${col} ASC OFFSET $${params.length + 1} LIMIT $${params.length + 2}`;
    const valueResult = await pool.query(valueSql, [...params, skip, limit]);

    return {
      items: valueResult.rows.map((r: Record<string, unknown>) => ({
        label: String(r.value),
        value: r.value,
      })),
      total,
    };
  }

  async translateValues(
    encryptedConnStr: string,
    database: string,
    collection: string,
    sourceField: string,
    targetField: string,
    sourceValues: unknown[],
  ): Promise<unknown[]> {
    if (targetField === sourceField) return sourceValues;
    const pool = this.pg.getPool(encryptedConnStr, database);
    const table = `"${collection.replace(/"/g, '""')}"`;
    const srcCol = `"${sourceField.replace(/"/g, '""')}"`;
    const tgtCol = `"${targetField.replace(/"/g, '""')}"`;

    const result = await pool.query(
      `SELECT DISTINCT ${tgtCol} AS value FROM ${table} WHERE ${srcCol} = ANY($1) AND ${tgtCol} IS NOT NULL`,
      [sourceValues],
    );
    return result.rows.map((r: Record<string, unknown>) => r.value);
  }

  /**
   * The compiler produces SQL with a placeholder base table.
   * This replaces the first FROM clause's table reference.
   */
  private setBaseTable(
    compiled: { text: string; values: unknown[] },
    table: string,
  ): { text: string; values: unknown[] } {
    // The compiler outputs FROM "" (empty ident) as placeholder when no source is set
    // We need to inject the actual table name
    const tableIdent = `"${table.replace(/"/g, '""')}"`;

    // Replace the first FROM "" with FROM "actual_table"
    const text = compiled.text.replace(/FROM ""/, `FROM ${tableIdent}`);

    return { text, values: compiled.values };
  }

  private ensureLimit(
    sql: { text: string; values: unknown[] },
    maxLimit: number,
  ): { text: string; values: unknown[] } {
    if (/\bLIMIT\s+\d+/i.test(sql.text)) return sql;
    return {
      text: `${sql.text}\nLIMIT ${maxLimit}`,
      values: sql.values,
    };
  }

  private inferFieldsFromRows(rows: Record<string, unknown>[]): FieldSchema[] {
    if (rows.length === 0) return [];

    const fieldTypes = new Map<string, Set<string>>();

    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        const types = fieldTypes.get(key)!;
        if (value === null || value === undefined) {
          types.add('null');
        } else if (Array.isArray(value)) {
          types.add('array');
        } else if (value instanceof Date) {
          types.add('date');
        } else if (typeof value === 'object') {
          types.add('object');
        } else if (typeof value === 'number' || typeof value === 'bigint') {
          types.add('number');
        } else if (typeof value === 'boolean') {
          types.add('boolean');
        } else {
          types.add('string');
        }
      }
    }

    const result: FieldSchema[] = [];
    for (const [name, types] of fieldTypes) {
      const nonNull = [...types].filter((t) => t !== 'null');
      const type =
        nonNull.length === 0
          ? 'null'
          : nonNull.length === 1
            ? nonNull[0]
            : 'mixed';
      result.push({ name, type });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}
