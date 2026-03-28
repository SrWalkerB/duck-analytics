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
    activeFilters?: Record<string, unknown[]>,
    relationships?: {
      id: string;
      sourceFilterId: string;
      targetFilterId: string;
      sourceField: string;
      targetField: string;
    }[],
  ) {
    const filter = await this.findOne(filterId);

    const fieldName = filter.field;

    // Query-based filter: execute the saved query and extract distinct values from the field column
    if (filter.queryId) {
      const result = await this.queries.execute(filter.queryId, userId);
      const seen = new Set<string>();
      let items: { label: string; value: unknown }[] = [];
      for (const row of result.data) {
        const val = row[fieldName];
        if (val == null) continue;
        const key = String(val);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ label: String(val), value: val });
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        items = items.filter((i) => regex.test(i.label));
      }

      items.sort((a, b) => a.label.localeCompare(b.label));

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

    // Apply relationship constraints: filter values based on active selections in related filters
    if (relationships?.length && activeFilters) {
      console.log('[getValues] Relationship constraints:', JSON.stringify({ filterId, relationships: relationships.length, activeFilters }));
      for (const rel of relationships) {
        if (rel.targetFilterId !== filterId) continue;
        const sourceValues = activeFilters[rel.sourceFilterId];
        if (!sourceValues || sourceValues.length === 0) continue;

        // Translate source filter's selected values (field/label values) to sourceField values
        // e.g. selected category names → category _id values
        const sourceFilter = await this.findOne(rel.sourceFilterId);
        let matchValues: unknown[] = sourceValues;

        console.log('[getValues] Rel constraint:', JSON.stringify({
          sourceField: rel.sourceField,
          targetField: rel.targetField,
          sourceFilterField: sourceFilter.field,
          sourceValues,
          needsTranslation: rel.sourceField !== sourceFilter.field,
        }));

        if (rel.sourceField !== sourceFilter.field) {
          const sourceDs = await this.dataSources.findOne(
            sourceFilter.dataSourceId,
            userId,
          );
          const sourceDb = await this.mongodb.getDb(
            sourceDs.connectionString,
            sourceDs.database,
          );
          const translated = await sourceDb
            .collection(sourceFilter.collection)
            .aggregate([
              { $match: { [sourceFilter.field]: { $in: sourceValues } } },
              { $group: { _id: `$${rel.sourceField}` } },
            ])
            .toArray();
          matchValues = translated
            .map((r) => r._id)
            .filter((v) => v != null);
          console.log('[getValues] Translated values:', matchValues);
        }

        pipeline.push({
          $match: {
            [rel.targetField]: { $in: matchValues },
          },
        });
      }
      console.log('[getValues] Final pipeline:', JSON.stringify(pipeline));
    }

    if (search) {
      pipeline.push({
        $match: { [fieldName]: { $regex: search, $options: 'i' } },
      });
    }

    const skip = (page - 1) * pageSize;

    pipeline.push(
      { $group: { _id: `$${fieldName}` } },
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
