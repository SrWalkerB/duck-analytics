import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { QueriesService } from '../queries/queries.service';
import type { CreateFilterDto } from './dto/create-filter.dto';
import type { UpdateFilterDto } from './dto/update-filter.dto';

@Injectable()
export class FiltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongodb: MongoDBService,
    private readonly dataSources: DataSourcesService,
    private readonly queries: QueriesService,
  ) {}

  async findAllByDashboard(dashboardId: string) {
    return this.prisma.dashboardFilter.findMany({
      where: { dashboardId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.dashboardFilter.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Filter not found');
    return f;
  }

  async create(dashboardId: string, dto: CreateFilterDto) {
    // Auto-assign order: next after current max
    const last = await this.prisma.dashboardFilter.findFirst({
      where: { dashboardId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (last?.order ?? -1) + 1;

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
        valueField: dto.valueField,
        queryId: dto.queryId,
        order: nextOrder,
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
        ...(dto.valueField !== undefined && { valueField: dto.valueField ?? null }),
        ...(dto.queryId !== undefined && { queryId: dto.queryId ?? null }),
      },
    });
  }

  async reorder(filterIds: string[]) {
    const updates = filterIds.map((id, index) =>
      this.prisma.dashboardFilter.update({
        where: { id },
        data: { order: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return { ok: true };
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

    const labelField = filter.field;
    const valField = filter.valueField ?? filter.field;

    // Query-based filter: execute the saved query and extract values from the field column
    if (filter.queryId) {
      const result = await this.queries.execute(filter.queryId, userId);
      // Build label→value pairs, dedup by value
      const seen = new Set<string>();
      let items: { label: string; value: unknown }[] = [];
      for (const row of result.data) {
        const label = row[labelField];
        const value = row[valField];
        if (label == null || value == null) continue;
        const key = String(value);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ label: String(label), value });
      }

      // Apply search filter on label
      if (search) {
        const regex = new RegExp(search, 'i');
        items = items.filter((i) => regex.test(i.label));
      }

      // Sort by label
      items.sort((a, b) => a.label.localeCompare(b.label));

      // Paginate
      const skip = (page - 1) * pageSize;
      return {
        items: items.slice(skip, skip + pageSize),
        page,
        pageSize,
      };
    }

    // Simple mode: distinct aggregation on the collection
    const ds = await this.dataSources.findOne(filter.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const pipeline: object[] = [];

    if (parentValue !== undefined && filter.parentFilterId) {
      const parent = await this.findOne(filter.parentFilterId);
      const values =
        typeof parentValue === 'string' && parentValue.includes(',')
          ? parentValue.split(',')
          : parentValue;
      pipeline.push({
        $match: {
          [parent.field]: Array.isArray(values) ? { $in: values } : values,
        },
      });
    }

    if (search) {
      pipeline.push({
        $match: { [labelField]: { $regex: search, $options: 'i' } },
      });
    }

    const skip = (page - 1) * pageSize;
    const hasValueField = filter.valueField && filter.valueField !== filter.field;

    if (hasValueField) {
      // Group by valueField, pick first label
      pipeline.push(
        {
          $group: {
            _id: `$${valField}`,
            label: { $first: `$${labelField}` },
          },
        },
        { $sort: { label: 1 } },
        { $skip: skip },
        { $limit: pageSize },
      );

      const results = await db
        .collection(filter.collection)
        .aggregate(pipeline)
        .toArray();
      return {
        items: results
          .filter((r) => r._id !== null)
          .map((r) => ({ label: String(r.label), value: r._id })),
        page,
        pageSize,
      };
    }

    // No valueField — label and value are the same
    pipeline.push(
      { $group: { _id: `$${labelField}` } },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: pageSize },
    );

    const results = await db
      .collection(filter.collection)
      .aggregate(pipeline)
      .toArray();
    return {
      items: results
        .filter((r) => r._id !== null)
        .map((r) => ({ label: String(r._id), value: r._id })),
      page,
      pageSize,
    };
  }
}
