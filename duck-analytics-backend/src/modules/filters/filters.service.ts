import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import type { CreateFilterDto } from './dto/create-filter.dto';
import type { UpdateFilterDto } from './dto/update-filter.dto';

@Injectable()
export class FiltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongodb: MongoDBService,
    private readonly dataSources: DataSourcesService,
  ) {}

  async findAllByDashboard(dashboardId: string) {
    return this.prisma.dashboardFilter.findMany({
      where: { dashboardId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.dashboardFilter.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Filter not found');
    return f;
  }

  async create(dashboardId: string, dto: CreateFilterDto) {
    return this.prisma.dashboardFilter.create({
      data: {
        dashboardId,
        label: dto.label,
        type: dto.type,
        field: dto.field,
        collection: dto.collection,
        dataSourceId: dto.dataSourceId,
        parentFilterId: dto.parentFilterId,
        targetMappings: (dto.targetMappings ?? []) as object,
      },
    });
  }

  async update(id: string, dto: UpdateFilterDto) {
    await this.findOne(id);
    return this.prisma.dashboardFilter.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.field !== undefined && { field: dto.field }),
        ...(dto.collection !== undefined && { collection: dto.collection }),
        ...(dto.dataSourceId !== undefined && { dataSourceId: dto.dataSourceId }),
        ...(dto.parentFilterId !== undefined && { parentFilterId: dto.parentFilterId }),
        ...(dto.targetMappings !== undefined && { targetMappings: dto.targetMappings as object }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.dashboardFilter.delete({ where: { id } });
  }

  async getValues(
    filterId: string,
    userId: string,
    page: number,
    pageSize: number,
    search?: string,
    parentValue?: unknown,
  ) {
    const filter = await this.findOne(filterId);
    const ds = await this.dataSources.findOne(filter.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const pipeline: object[] = [];

    if (parentValue !== undefined && filter.parentFilterId) {
      const parent = await this.findOne(filter.parentFilterId);
      // Support comma-separated values for multi-select parent filters
      const values = typeof parentValue === 'string' && parentValue.includes(',')
        ? parentValue.split(',')
        : parentValue;
      pipeline.push({
        $match: { [parent.field]: Array.isArray(values) ? { $in: values } : values },
      });
    }

    if (search) {
      pipeline.push({
        $match: { [filter.field]: { $regex: search, $options: 'i' } },
      });
    }

    const skip = (page - 1) * pageSize;
    pipeline.push(
      { $group: { _id: `$${filter.field}` } },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: pageSize },
    );

    const results = await db
      .collection(filter.collection)
      .aggregate(pipeline)
      .toArray();
    return {
      values: results.map((r) => r._id).filter((v) => v !== null),
      page,
      pageSize,
    };
  }
}
