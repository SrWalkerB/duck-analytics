import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { QueryBuilderService } from './query-builder.service';
import type { QueryFilter, QueryConfiguration } from './query-builder.service';
import type { CreateQueryDto } from './dto/create-query.dto';
import type { UpdateQueryDto } from './dto/update-query.dto';
import type { PreviewQueryDto } from './dto/preview-query.dto';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSources: DataSourcesService,
    private readonly mongodb: MongoDBService,
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
    const pipeline = this.builder.compile(dto.configuration as QueryConfiguration);
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
        ...(dto.dataSourceId !== undefined && { dataSourceId: dto.dataSourceId }),
        ...(dto.collection !== undefined && { collection: dto.collection }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.configuration !== undefined && {
          configuration: dto.configuration as object,
          pipeline: this.builder.compile(dto.configuration as QueryConfiguration) as object,
        }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.query.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async execute(id: string, userId: string, injectedFilters?: QueryFilter[]) {
    const query = await this.findOne(id, userId);
    const ds = await this.dataSources.findOne(query.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const pipeline = this.builder.compile(query.configuration as QueryConfiguration, injectedFilters);
    const results = await db.collection(query.collection).aggregate(pipeline as object[]).toArray();
    return { data: results, count: results.length };
  }

  async preview(userId: string, dto: PreviewQueryDto) {
    const ds = await this.dataSources.findOne(dto.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const pipeline = this.builder.compile({ ...(dto.configuration as QueryConfiguration), limit: 1000 });
    const results = await db.collection(dto.collection).aggregate(pipeline as object[]).toArray();
    return { data: results, count: results.length };
  }
}
