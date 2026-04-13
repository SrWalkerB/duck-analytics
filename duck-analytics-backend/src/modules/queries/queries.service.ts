import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { DatabaseAdapterFactory } from '../../lib/database/database-adapter.factory';
import { QueryBuilderService } from './query-builder.service';
import {
  isPipelineConfiguration,
  type QueryFilter,
  type QueryConfigurationAny,
  type FieldSchema,
  type MatchableField,
  type PipelineConfiguration,
} from './query-builder.service';
import type { CreateQueryDto } from './dto/create-query.dto';
import type { UpdateQueryDto } from './dto/update-query.dto';
import type { PreviewQueryDto } from './dto/preview-query.dto';
import type { PreviewPartialQueryDto } from './dto/preview-partial-query.dto';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSources: DataSourcesService,
    private readonly adapterFactory: DatabaseAdapterFactory,
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

  async getOutputFields(
    queryId: string,
    userId: string,
  ): Promise<FieldSchema[]> {
    const query = await this.findOne(queryId, userId);
    const ds = await this.dataSources.findOne(query.dataSourceId, userId);
    const adapter = this.adapterFactory.getAdapter(ds.type);
    const config = query.configuration as QueryConfigurationAny;

    const baseFields = await adapter.inferSchema(
      ds.connectionString,
      ds.database,
      query.collection,
    );

    const foreignSchemas = new Map<string, FieldSchema[]>();
    const lookupCollections = this.extractLookupCollections(config);
    await Promise.all(
      lookupCollections.map(async (col) => {
        const fields = await adapter.inferSchema(
          ds.connectionString,
          ds.database,
          col,
        );
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
    const adapter = this.adapterFactory.getAdapter(ds.type);
    const config = query.configuration as QueryConfigurationAny;

    const baseFields = await adapter.inferSchema(
      ds.connectionString,
      ds.database,
      query.collection,
    );

    const foreignSchemas = new Map<string, FieldSchema[]>();
    const lookupCollections = this.extractLookupCollections(config);
    await Promise.all(
      lookupCollections.map(async (col) => {
        const fields = await adapter.inferSchema(
          ds.connectionString,
          ds.database,
          col,
        );
        foreignSchemas.set(col, fields);
      }),
    );

    return this.builder.getMatchableFields(config, baseFields, foreignSchemas);
  }

  private extractLookupCollections(config: QueryConfigurationAny): string[] {
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
    const adapter = this.adapterFactory.getAdapter(ds.type);
    return adapter.execute(
      ds.connectionString,
      ds.database,
      query.collection,
      query.configuration as QueryConfigurationAny,
      injectedFilters,
    );
  }

  async executeInternal(id: string, injectedFilters?: QueryFilter[]) {
    const query = await this.prisma.query.findFirst({
      where: { id, deletedAt: null },
      include: { dataSource: true },
    });
    if (!query) throw new NotFoundException('Query not found');
    const adapter = this.adapterFactory.getAdapter(query.dataSource.type);
    return adapter.execute(
      query.dataSource.connectionString,
      query.dataSource.database,
      query.collection,
      query.configuration as QueryConfigurationAny,
      injectedFilters,
    );
  }

  async preview(userId: string, dto: PreviewQueryDto) {
    const ds = await this.dataSources.findOne(dto.dataSourceId, userId);
    const adapter = this.adapterFactory.getAdapter(ds.type);
    return adapter.preview(
      ds.connectionString,
      ds.database,
      dto.collection,
      dto.configuration as QueryConfigurationAny,
    );
  }

  async previewPartial(userId: string, dto: PreviewPartialQueryDto) {
    const ds = await this.dataSources.findOne(dto.dataSourceId, userId);
    const adapter = this.adapterFactory.getAdapter(ds.type);
    return adapter.executePartial(
      ds.connectionString,
      ds.database,
      dto.collection,
      dto.configuration as unknown as PipelineConfiguration,
      dto.upToStageId,
    );
  }
}
