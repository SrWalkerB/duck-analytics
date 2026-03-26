import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { MongoDBIntrospectionService } from '../../lib/mongodb/mongodb-introspection.service';
import { QueryBuilderService } from './query-builder.service';
import {
  isPipelineConfiguration,
  type QueryFilter,
  type QueryConfigurationAny,
  type FieldSchema,
  type MatchableField,
} from './query-builder.service';
import type { CreateQueryDto } from './dto/create-query.dto';
import type { UpdateQueryDto } from './dto/update-query.dto';
import type { PreviewQueryDto } from './dto/preview-query.dto';
import type { PreviewPartialQueryDto } from './dto/preview-partial-query.dto';
import type { PipelineConfiguration } from './query-builder.service';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSources: DataSourcesService,
    private readonly mongodb: MongoDBService,
    private readonly introspection: MongoDBIntrospectionService,
    private readonly builder: QueryBuilderService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.query.findMany({
      where: { userId, deletedAt: null },
      include: { dataSource: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const q = await this.prisma.query.findFirst({
      where: { id, userId, deletedAt: null },
      include: { dataSource: true },
    });
    if (!q) throw new NotFoundException('Query not found');
    return q;
  }

  async create(userId: string, dto: CreateQueryDto) {
    const pipeline = this.builder.compileAny(
      dto.configuration as QueryConfigurationAny,
    );
    return this.prisma.query.create({
      data: {
        name: dto.name,
        dataSourceId: dto.dataSourceId,
        collection: dto.collection,
        configuration: dto.configuration as object,
        pipeline: pipeline as object,
        userId,
        folderId: dto.folderId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateQueryDto) {
    await this.findOne(id, userId);
    return this.prisma.query.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.dataSourceId !== undefined && {
          dataSourceId: dto.dataSourceId,
        }),
        ...(dto.collection !== undefined && { collection: dto.collection }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.configuration !== undefined && {
          configuration: dto.configuration as object,
          pipeline: this.builder.compileAny(
            dto.configuration as QueryConfigurationAny,
          ) as object,
        }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.query.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Returns the output fields of a query by statically analyzing
   * its pipeline configuration, considering $lookup and $group stages.
   */
  async getOutputFields(
    queryId: string,
    userId: string,
  ): Promise<FieldSchema[]> {
    const query = await this.findOne(queryId, userId);
    const ds = await this.dataSources.findOne(query.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const config = query.configuration as QueryConfigurationAny;

    // Get base collection fields
    const baseFields = await this.introspection.inferSchema(
      db,
      query.collection,
    );

    // Get foreign collection schemas for $lookup stages
    const foreignSchemas = new Map<string, FieldSchema[]>();
    const lookupCollections = this.extractLookupCollections(config);
    await Promise.all(
      lookupCollections.map(async (col) => {
        const fields = await this.introspection.inferSchema(db, col);
        foreignSchemas.set(col, fields);
      }),
    );

    return this.builder.getOutputFields(config, baseFields, foreignSchemas);
  }

  async getMatchableFields(
    queryId: string,
    userId: string,
  ): Promise<MatchableField[]> {
    const query = await this.findOne(queryId, userId);
    const ds = await this.dataSources.findOne(query.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const config = query.configuration as QueryConfigurationAny;

    const baseFields = await this.introspection.inferSchema(
      db,
      query.collection,
    );

    const foreignSchemas = new Map<string, FieldSchema[]>();
    const lookupCollections = this.extractLookupCollections(config);
    await Promise.all(
      lookupCollections.map(async (col) => {
        const fields = await this.introspection.inferSchema(db, col);
        foreignSchemas.set(col, fields);
      }),
    );

    return this.builder.getMatchableFields(config, baseFields, foreignSchemas);
  }

  private extractLookupCollections(
    config: QueryConfigurationAny,
  ): string[] {
    if (isPipelineConfiguration(config)) {
      return config.stages
        .filter(
          (s): s is Extract<typeof s, { type: '$lookup' }> =>
            s.type === '$lookup' && s.enabled,
        )
        .map((s) => s.from);
    }
    return (config.lookups ?? []).map((l) => l.from);
  }

  async execute(id: string, userId: string, injectedFilters?: QueryFilter[]) {
    const query = await this.findOne(id, userId);
    const ds = await this.dataSources.findOne(query.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const pipeline = this.builder.compileAny(
      query.configuration as QueryConfigurationAny,
      injectedFilters,
    );
    const results = await db
      .collection(query.collection)
      .aggregate(pipeline as object[])
      .toArray();
    return { data: results, count: results.length };
  }

  async preview(userId: string, dto: PreviewQueryDto) {
    const ds = await this.dataSources.findOne(dto.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const config = dto.configuration as QueryConfigurationAny;
    const pipeline = this.builder.compileAny(config);
    // Enforce limit for preview
    pipeline.push({ $limit: 1000 });
    const results = await db
      .collection(dto.collection)
      .aggregate(pipeline as object[])
      .toArray();
    return { data: results, count: results.length };
  }

  async previewPartial(userId: string, dto: PreviewPartialQueryDto) {
    const ds = await this.dataSources.findOne(dto.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const config = dto.configuration as unknown as PipelineConfiguration;
    const pipeline = this.builder.compilePartial(config, dto.upToStageId);
    pipeline.push({ $limit: 1000 });
    const results = await db
      .collection(dto.collection)
      .aggregate(pipeline as object[])
      .toArray();

    // Infer fields from result documents
    const inferredFields = this.inferFieldsFromDocs(results.slice(0, 20));

    return { data: results, count: results.length, inferredFields };
  }

  private inferFieldsFromDocs(
    docs: Record<string, unknown>[],
  ): { name: string; type: string }[] {
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
          // Check for MongoDB special types
          const obj = value as Record<string, unknown>;
          if ('$oid' in obj) types.add('objectId');
          else if ('$date' in obj) types.add('date');
          else types.add('object');
        } else {
          types.add(typeof value);
        }
      }
    }

    const result: { name: string; type: string }[] = [];
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
