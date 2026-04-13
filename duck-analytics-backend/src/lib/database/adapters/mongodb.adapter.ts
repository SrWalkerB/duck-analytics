import { Injectable } from '@nestjs/common';
import { MongoDBService } from '../../mongodb/mongodb.service';
import { MongoDBIntrospectionService } from '../../mongodb/mongodb-introspection.service';
import {
  QueryBuilderService,
  type QueryConfigurationAny,
  type QueryFilter,
  type PipelineConfiguration,
  type FieldSchema,
} from '../../../modules/queries/query-builder.service';
import type { DatabaseAdapter } from '../database-adapter.interface';

@Injectable()
export class MongoDBAdapter implements DatabaseAdapter {
  constructor(
    private readonly mongodb: MongoDBService,
    private readonly introspection: MongoDBIntrospectionService,
    private readonly builder: QueryBuilderService,
  ) {}

  async testConnection(
    encryptedConnStr: string,
    database: string,
  ): Promise<void> {
    await this.mongodb.testConnection(encryptedConnStr, database);
  }

  async testRawConnection(connStr: string, database: string): Promise<void> {
    await this.mongodb.testRawConnection(connStr, database);
  }

  async listCollections(
    encryptedConnStr: string,
    database: string,
  ): Promise<string[]> {
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    return this.introspection.listCollections(db);
  }

  async inferSchema(
    encryptedConnStr: string,
    database: string,
    collection: string,
  ): Promise<FieldSchema[]> {
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    return this.introspection.inferSchema(db, collection);
  }

  async execute(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
    injectedFilters?: QueryFilter[],
  ): Promise<{ data: Record<string, unknown>[]; count: number }> {
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    const pipeline = this.builder.compileAny(config, injectedFilters);
    const results = await db
      .collection(collection)
      .aggregate(pipeline as object[])
      .toArray();
    return {
      data: results as Record<string, unknown>[],
      count: results.length,
    };
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
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    const pipeline = this.builder.compilePartial(config, upToStageId);
    pipeline.push({ $limit: 1000 });
    const results = await db
      .collection(collection)
      .aggregate(pipeline as object[])
      .toArray();
    const inferredFields = this.inferFieldsFromDocs(
      (results as Record<string, unknown>[]).slice(0, 20),
    );
    return {
      data: results as Record<string, unknown>[],
      count: results.length,
      inferredFields,
    };
  }

  async preview(
    encryptedConnStr: string,
    database: string,
    collection: string,
    config: QueryConfigurationAny,
  ): Promise<{ data: Record<string, unknown>[]; count: number }> {
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    const pipeline = this.builder.compileAny(config);
    pipeline.push({ $limit: 1000 });
    const results = await db
      .collection(collection)
      .aggregate(pipeline as object[])
      .toArray();
    return {
      data: results as Record<string, unknown>[],
      count: results.length,
    };
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
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    const matchPipeline: object[] = [];

    if (matchFilters) {
      for (const f of matchFilters) {
        if (f.operator === 'in') {
          matchPipeline.push({
            $match: { [f.field]: { $in: f.value as unknown[] } },
          });
        } else {
          matchPipeline.push({ $match: { [f.field]: f.value } });
        }
      }
    }

    if (search) {
      matchPipeline.push({
        $match: { [field]: { $regex: search, $options: 'i' } },
      });
    }

    const valueGrouping = { $group: { _id: `$${field}` } };

    const countResult = await db
      .collection(collection)
      .aggregate([...matchPipeline, valueGrouping, { $count: 'total' }])
      .toArray();
    const total = (countResult[0]?.['total'] as number) ?? 0;

    const results = await db
      .collection(collection)
      .aggregate([
        ...matchPipeline,
        valueGrouping,
        { $sort: { _id: 1 } },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();

    return {
      items: results
        .filter((r) => r._id !== null)
        .map((r) => ({ label: String(r._id), value: r._id as unknown })),
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
    const db = await this.mongodb.getDb(encryptedConnStr, database);
    const results = await db
      .collection(collection)
      .aggregate([
        { $match: { [sourceField]: { $in: sourceValues } } },
        { $group: { _id: `$${targetField}` } },
      ])
      .toArray();
    return results.map((r) => r._id as unknown).filter((v) => v != null);
  }

  private inferFieldsFromDocs(docs: Record<string, unknown>[]): FieldSchema[] {
    const fieldTypes = new Map<string, Set<string>>();

    for (const doc of docs) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        const types = fieldTypes.get(key)!;
        if (value === null || value === undefined) {
          types.add('null');
        } else if (Array.isArray(value)) {
          types.add('array');
        } else if (value instanceof Date) {
          types.add('date');
        } else if (typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if ('$oid' in obj) types.add('objectId');
          else if ('$date' in obj) types.add('date');
          else types.add('object');
        } else {
          types.add(typeof value);
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
