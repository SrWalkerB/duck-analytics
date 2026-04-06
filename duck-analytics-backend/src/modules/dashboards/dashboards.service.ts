import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ComponentsService } from '../components/components.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import type { CreateDashboardDto } from './dto/create-dashboard.dto';
import type { UpdateDashboardDto } from './dto/update-dashboard.dto';
import type { AddDashboardComponentDto } from './dto/add-dashboard-component.dto';
import type { UpdateLayoutDto } from './dto/update-layout.dto';
import type { QueryFilter } from '../queries/query-builder.service';

interface TargetMapping {
  componentId: string;
  targetField: string;
  valueField?: string;
  fieldType?: string;
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly components: ComponentsService,
    private readonly mongodb: MongoDBService,
    private readonly dataSources: DataSourcesService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.dashboard.findMany({
      where: { userId, deletedAt: null },
      include: {
        dashboardComponents: {
          include: {
            component: { select: { id: true, name: true, type: true } },
          },
        },
        embed: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const d = await this.prisma.dashboard.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        dashboardComponents: {
          include: {
            component: {
              include: {
                query: { select: { id: true, collection: true, dataSourceId: true } },
              },
            },
          },
        },
        dashboardFilters: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        embed: true,
      },
    });
    if (!d) throw new NotFoundException('Dashboard not found');
    return d;
  }

  async findOneByEmbedCode(embedCode: string) {
    const embed = await this.prisma.dashboardEmbed.findUnique({
      where: { embedCode },
      include: {
        dashboard: {
          include: {
            dashboardComponents: {
              include: {
                component: {
                  include: {
                    query: { select: { id: true, collection: true, dataSourceId: true } },
                  },
                },
              },
            },
            dashboardFilters: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    if (!embed || embed.dashboard.deletedAt)
      throw new NotFoundException('Embed not found');
    return embed;
  }

  async create(userId: string, dto: CreateDashboardDto) {
    return this.prisma.dashboard.create({
      data: {
        name: dto.name,
        description: dto.description,
        configuration: dto.configuration as object,
        userId,
        folderId: dto.folderId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateDashboardDto) {
    await this.findOne(id, userId);
    return this.prisma.dashboard.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.configuration !== undefined && {
          configuration: dto.configuration as object,
        }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.dashboard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addComponent(
    dashboardId: string,
    userId: string,
    dto: AddDashboardComponentDto,
  ) {
    await this.findOne(dashboardId, userId);
    return this.prisma.dashboardComponent.create({
      data: {
        dashboardId,
        componentId: dto.componentId,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        w: dto.w ?? 6,
        h: dto.h ?? 4,
        title: dto.title,
        backgroundColor: dto.backgroundColor,
        tabId: dto.tabId,
      },
    });
  }

  async removeComponent(dashboardId: string, dcId: string, userId: string) {
    await this.findOne(dashboardId, userId);
    return this.prisma.dashboardComponent.delete({ where: { id: dcId } });
  }

  async updateLayout(
    dashboardId: string,
    userId: string,
    dto: UpdateLayoutDto,
  ) {
    await this.findOne(dashboardId, userId);
    const updates = dto.layout.map((item) =>
      this.prisma.dashboardComponent.update({
        where: { id: item.id },
        data: {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          ...(item.tabId !== undefined && { tabId: item.tabId }),
          ...(item.title !== undefined && { title: item.title }),
          ...(item.description !== undefined && {
            description: item.description,
          }),
        },
      }),
    );
    await this.prisma.$transaction(updates);
    return { ok: true };
  }

  /**
   * Translate selected filter values (from filter.field) to the mapping's valueField
   * by querying the source collection.
   */
  private async translateValues(
    filter: { field: string; collection: string; dataSourceId: string },
    mapping: TargetMapping,
    selected: unknown[],
    userId: string,
  ): Promise<unknown[]> {
    if (!mapping.valueField || mapping.valueField === filter.field) {
      return selected;
    }
    const ds = await this.dataSources.findOne(filter.dataSourceId, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const results = await db
      .collection(filter.collection)
      .aggregate([
        { $match: { [filter.field]: { $in: selected } } },
        { $group: { _id: `$${mapping.valueField}` } },
      ])
      .toArray();
    return results.map((r) => r._id).filter((v) => v != null);
  }

  private async translateValuesInternal(
    filter: { field: string; collection: string; dataSourceId: string },
    mapping: TargetMapping,
    selected: unknown[],
  ): Promise<unknown[]> {
    if (!mapping.valueField || mapping.valueField === filter.field) {
      return selected;
    }
    const ds = await this.dataSources.findOneInternal(filter.dataSourceId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const results = await db
      .collection(filter.collection)
      .aggregate([
        { $match: { [filter.field]: { $in: selected } } },
        { $group: { _id: `$${mapping.valueField}` } },
      ])
      .toArray();
    return results.map((r) => r._id).filter((v) => v != null);
  }

  async getData(
    dashboardId: string,
    userId: string,
    activeFilters: Record<string, unknown[]> = {},
  ) {
    const dashboard = await this.findOne(dashboardId, userId);
    return this.getDataWithOwner(dashboard, activeFilters, userId);
  }

  /**
   * Fetch data for all components in a dashboard without userId checks.
   * Used by the embed module after access has been validated.
   */
  async getDataByDashboard(
    dashboard: Awaited<ReturnType<DashboardsService['findOne']>>,
    activeFilters: Record<string, unknown[]> = {},
  ) {
    const filters = dashboard.dashboardFilters;
    const results: Record<string, unknown> = {};

    await Promise.all(
      dashboard.dashboardComponents.map(async (dc) => {
        const injected: QueryFilter[] = [];
        for (const filter of filters) {
          const selected = activeFilters[filter.id];
          if (!selected || selected.length === 0) continue;
          const mappings =
            (filter.targetMappings as unknown as TargetMapping[]) ?? [];
          const mapping = mappings.find(
            (m) => m.componentId === dc.componentId,
          );
          if (!mapping) continue;

          const values = await this.translateValuesInternal(
            filter,
            mapping,
            selected,
          );

          injected.push({
            field: mapping.targetField,
            operator: 'in',
            value: values,
            fieldType: mapping.fieldType,
          });
        }

        try {
          results[dc.id] = await this.components.getDataInternal(
            dc.componentId,
            injected.length > 0 ? injected : undefined,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[Dashboard getData] component ${dc.componentId} failed:`,
            msg,
          );
          results[dc.id] = { error: msg };
        }
      }),
    );
    return results;
  }

  private async getDataWithOwner(
    dashboard: Awaited<ReturnType<DashboardsService['findOne']>>,
    activeFilters: Record<string, unknown[]>,
    userId: string,
  ) {
    const filters = dashboard.dashboardFilters;
    const results: Record<string, unknown> = {};

    await Promise.all(
      dashboard.dashboardComponents.map(async (dc) => {
        const injected: QueryFilter[] = [];
        for (const filter of filters) {
          const selected = activeFilters[filter.id];
          if (!selected || selected.length === 0) continue;
          const mappings =
            (filter.targetMappings as unknown as TargetMapping[]) ?? [];
          const mapping = mappings.find(
            (m) => m.componentId === dc.componentId,
          );
          if (!mapping) continue;

          const values = await this.translateValues(
            filter,
            mapping,
            selected,
            userId,
          );

          injected.push({
            field: mapping.targetField,
            operator: 'in',
            value: values,
            fieldType: mapping.fieldType,
          });
        }

        try {
          results[dc.id] = await this.components.getData(
            dc.componentId,
            userId,
            injected.length > 0 ? injected : undefined,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[Dashboard getData] component ${dc.componentId} failed:`,
            msg,
          );
          results[dc.id] = { error: msg };
        }
      }),
    );
    return results;
  }
}
