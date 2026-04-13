import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { DatabaseAdapterFactory } from '../../lib/database/database-adapter.factory';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { QueriesService } from '../queries/queries.service';
import type { QueryFilter } from '../queries/query-builder.service';
import type { CreateFilterDto } from './dto/create-filter.dto';
import type { UpdateFilterDto } from './dto/update-filter.dto';

@Injectable()
export class FiltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterFactory: DatabaseAdapterFactory,
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
        ...(dto.dataSourceId !== undefined && {
          dataSourceId: dto.dataSourceId,
        }),
        ...(dto.parentFilterId !== undefined && {
          parentFilterId: dto.parentFilterId,
        }),
        ...(dto.targetMappings !== undefined && {
          targetMappings: dto.targetMappings as object,
        }),
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

  private parseParentValue(parentValue?: unknown): unknown {
    if (parentValue === undefined) return undefined;
    if (typeof parentValue === 'string' && parentValue.includes(',')) {
      return parentValue.split(',');
    }
    return parentValue;
  }

  private async resolveRelationshipConstraints(
    filterId: string,
    userId: string,
    activeFilters?: Record<string, unknown[]>,
    relationships?: {
      id: string;
      sourceFilterId: string;
      targetFilterId: string;
      sourceField: string;
      targetField: string;
    }[],
  ): Promise<{ targetField: string; values: unknown[] }[]> {
    const constraints: { targetField: string; values: unknown[] }[] = [];
    if (!relationships?.length || !activeFilters) return constraints;

    for (const rel of relationships) {
      if (rel.targetFilterId !== filterId) continue;
      const sourceValues = activeFilters[rel.sourceFilterId];
      if (!sourceValues || sourceValues.length === 0) continue;

      const sourceFilter = await this.findOne(rel.sourceFilterId);
      let matchValues: unknown[] = sourceValues;

      if (rel.sourceField !== sourceFilter.field) {
        const sourceDs = await this.dataSources.findOne(
          sourceFilter.dataSourceId,
          userId,
        );
        const adapter = this.adapterFactory.getAdapter(sourceDs.type);
        matchValues = await adapter.translateValues(
          sourceDs.connectionString,
          sourceDs.database,
          sourceFilter.collection,
          sourceFilter.field,
          rel.sourceField,
          sourceValues,
        );
      }

      constraints.push({ targetField: rel.targetField, values: matchValues });
    }

    return constraints;
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
    const parsedParentValue = this.parseParentValue(parentValue);
    const relationshipConstraints = await this.resolveRelationshipConstraints(
      filterId,
      userId,
      activeFilters,
      relationships,
    );

    // Query-based filter: execute the saved query and extract distinct values
    if (filter.queryId) {
      const injectedFilters: QueryFilter[] = [];

      if (parsedParentValue !== undefined && filter.parentFilterId) {
        const parent = await this.findOne(filter.parentFilterId);
        injectedFilters.push({
          field: parent.field,
          operator: Array.isArray(parsedParentValue) ? 'in' : 'eq',
          value: parsedParentValue,
        });
      }

      for (const constraint of relationshipConstraints) {
        injectedFilters.push({
          field: constraint.targetField,
          operator: 'in',
          value: constraint.values,
        });
      }

      const result = await this.queries.execute(
        filter.queryId,
        userId,
        injectedFilters.length > 0 ? injectedFilters : undefined,
      );
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
      const total = items.length;
      return {
        items: items.slice(skip, skip + pageSize),
        page,
        pageSize,
        total,
      };
    }

    // Simple mode: use adapter's getDistinctValues
    const ds = await this.dataSources.findOne(filter.dataSourceId, userId);
    const adapter = this.adapterFactory.getAdapter(ds.type);

    const matchFilters: { field: string; value: unknown; operator: string }[] =
      [];

    if (parsedParentValue !== undefined && filter.parentFilterId) {
      const parent = await this.findOne(filter.parentFilterId);
      matchFilters.push({
        field: parent.field,
        value: Array.isArray(parsedParentValue)
          ? parsedParentValue
          : parsedParentValue,
        operator: Array.isArray(parsedParentValue) ? 'in' : 'eq',
      });
    }

    for (const constraint of relationshipConstraints) {
      matchFilters.push({
        field: constraint.targetField,
        value: constraint.values,
        operator: 'in',
      });
    }

    const skip = (page - 1) * pageSize;
    const result = await adapter.getDistinctValues(
      ds.connectionString,
      ds.database,
      filter.collection,
      fieldName,
      matchFilters.length > 0 ? matchFilters : undefined,
      search,
      skip,
      pageSize,
    );

    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
    };
  }
}
