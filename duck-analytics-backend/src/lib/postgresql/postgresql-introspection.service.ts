import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { FieldSchema } from '../../modules/queries/query-builder.service';

type PoolType = InstanceType<typeof pg.Pool>;

@Injectable()
export class PostgreSQLIntrospectionService {
  async listTables(pool: PoolType): Promise<string[]> {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return result.rows.map((r) => r.table_name);
  }

  async inferSchema(pool: PoolType, tableName: string): Promise<FieldSchema[]> {
    const result = await pool.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );

    return result.rows.map((row) => ({
      name: row.column_name,
      type: this.mapPgType(row.data_type, row.udt_name),
    }));
  }

  private mapPgType(dataType: string, udtName: string): string {
    const dt = dataType.toLowerCase();
    const udt = udtName.toLowerCase();

    // Numeric types
    if (
      [
        'integer',
        'bigint',
        'smallint',
        'numeric',
        'real',
        'double precision',
      ].includes(dt)
    ) {
      return 'number';
    }
    if (['int4', 'int8', 'int2', 'float4', 'float8', 'numeric'].includes(udt)) {
      return 'number';
    }

    // String types
    if (
      ['character varying', 'text', 'character', 'varchar', 'char'].includes(
        dt,
      ) ||
      udt === 'varchar' ||
      udt === 'text'
    ) {
      return 'string';
    }

    // UUID
    if (dt === 'uuid' || udt === 'uuid') return 'string';

    // Boolean
    if (dt === 'boolean' || udt === 'bool') return 'boolean';

    // Date/time
    if (dt.startsWith('timestamp') || dt === 'date' || dt.startsWith('time')) {
      return 'date';
    }

    // JSON
    if (dt === 'json' || dt === 'jsonb' || udt === 'json' || udt === 'jsonb') {
      return 'object';
    }

    // Array
    if (dt === 'ARRAY' || udt.startsWith('_')) return 'array';

    return 'string';
  }
}
