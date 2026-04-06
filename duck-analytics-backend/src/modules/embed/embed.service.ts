import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { LogsService } from '../../lib/logs/logs.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { QueriesService } from '../queries/queries.service';
import { env } from '../../env';
import type { PublishDashboardDto } from './dto/publish-dashboard.dto';
import type { LogLevel } from '../../generated/prisma';
import type { QueryFilter } from '../queries/query-builder.service';

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class EmbedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardsService,
    private readonly jwt: JwtService,
    private readonly logs: LogsService,
    private readonly mongodb: MongoDBService,
    private readonly dataSources: DataSourcesService,
    private readonly queries: QueriesService,
  ) {}

  private emitLog(
    userId: string,
    level: LogLevel,
    event: string,
    message: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ) {
    this.logs.log({
      userId,
      level: level,
      source: 'embed',
      event,
      resourceId,
      message,
      metadata,
    });
  }

  async publish(dashboardId: string, userId: string, dto: PublishDashboardDto) {
    await this.dashboards.findOne(dashboardId, userId);

    const embedCode = nanoid(21);
    const embedSecret =
      dto.embedType === 'JWT_SECURED'
        ? randomBytes(32).toString('hex')
        : null;

    const embed = await this.prisma.dashboardEmbed.upsert({
      where: { dashboardId },
      create: {
        dashboardId,
        embedCode,
        embedType: dto.embedType,
        showFilters: dto.showFilters,
        showTitle: dto.showTitle,
        embedSecret,
      },
      update: {
        embedType: dto.embedType,
        showFilters: dto.showFilters,
        showTitle: dto.showTitle,
        ...(dto.embedType === 'JWT_SECURED' && !embedSecret
          ? {}
          : { embedSecret }),
      },
    });

    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: { status: 'PUBLISHED' },
    });

    return embed;
  }

  async unpublish(dashboardId: string, userId: string) {
    await this.dashboards.findOne(dashboardId, userId);

    await this.prisma.dashboardEmbed
      .delete({ where: { dashboardId } })
      .catch(() => {
        /* embed may not exist */
      });

    await this.prisma.dashboard.update({
      where: { id: dashboardId },
      data: { status: 'DRAFT' },
    });

    return { ok: true };
  }

  async updateSettings(
    dashboardId: string,
    userId: string,
    dto: PublishDashboardDto,
  ) {
    await this.dashboards.findOne(dashboardId, userId);

    const existing = await this.prisma.dashboardEmbed.findUnique({
      where: { dashboardId },
    });
    if (!existing) throw new NotFoundException('Dashboard is not published');

    const needsSecret =
      dto.embedType === 'JWT_SECURED' && !existing.embedSecret;
    const embedSecret = needsSecret
      ? randomBytes(32).toString('hex')
      : undefined;

    return this.prisma.dashboardEmbed.update({
      where: { dashboardId },
      data: {
        embedType: dto.embedType,
        showFilters: dto.showFilters,
        showTitle: dto.showTitle,
        ...(embedSecret && { embedSecret }),
      },
    });
  }

  async getEmbed(embedCode: string, token?: string, meta?: RequestMeta) {
    const embed = await this.dashboards.findOneByEmbedCode(embedCode);
    const userId = embed.dashboard.userId;

    if (embed.embedType === 'JWT_SECURED') {
      this.validateEmbedToken(embed, token, userId, meta);
    }

    this.emitLog(userId, 'INFO', 'ACCESS', `Embed accessed: ${embedCode}`, embed.id, {
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      dashboard: embed.dashboard,
      showFilters: embed.showFilters,
      showTitle: embed.showTitle,
      embedType: embed.embedType,
    };
  }

  async getEmbedData(
    embedCode: string,
    token: string | undefined,
    activeFilters: Record<string, unknown[]>,
    meta?: RequestMeta,
  ) {
    const embed = await this.dashboards.findOneByEmbedCode(embedCode);
    const userId = embed.dashboard.userId;

    if (embed.embedType === 'JWT_SECURED') {
      this.validateEmbedToken(embed, token, userId, meta);
    }

    try {
      const data = await this.dashboards.getDataByDashboard(
        embed.dashboard,
        activeFilters,
      );
      this.emitLog(userId, 'INFO', 'DATA_FETCH', 'Data fetched successfully', embed.id, {
        ip: meta?.ip,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitLog(userId, 'ERROR', 'DATA_ERROR', msg, embed.id, {
        ip: meta?.ip,
        error: msg,
      });
      throw err;
    }
  }

  async generateToken(dashboardId: string, userId: string) {
    await this.dashboards.findOne(dashboardId, userId);

    const embed = await this.prisma.dashboardEmbed.findUnique({
      where: { dashboardId },
    });
    if (!embed) throw new NotFoundException('Dashboard is not published');
    if (embed.embedType !== 'JWT_SECURED') {
      throw new BadRequestException(
        'Token generation is only available for JWT-secured embeds',
      );
    }

    const secret = embed.embedSecret || env.EMBED_JWT_SECRET || env.JWT_SECRET;
    const token = this.jwt.sign(
      { embedCode: embed.embedCode, type: 'embed' },
      { secret, expiresIn: '1h' },
    );

    return {
      token,
      embedCode: embed.embedCode,
      expiresIn: '1h',
    };
  }

  async getEmbedFilterValues(
    embedCode: string,
    filterId: string,
    token: string | undefined,
    params: { page?: number; pageSize?: number; search?: string; parentValue?: unknown },
    meta?: RequestMeta,
  ) {
    const embed = await this.dashboards.findOneByEmbedCode(embedCode);
    const userId = embed.dashboard.userId;

    if (embed.embedType === 'JWT_SECURED') {
      this.validateEmbedToken(embed, token, userId, meta);
    }

    const filter = await this.prisma.dashboardFilter.findFirst({
      where: { id: filterId, dashboardId: embed.dashboard.id },
    });
    if (!filter) throw new NotFoundException('Filter not found');

    const { page = 1, pageSize = 50, search, parentValue } = params;

    try {
      const result = await this.getFilterValuesInternal(
        filter,
        page,
        pageSize,
        search,
        parentValue,
      );
      this.emitLog(userId, 'INFO', 'FILTER_VALUES', `Filter values fetched: ${filter.label}`, embed.id, {
        ip: meta?.ip,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitLog(userId, 'ERROR', 'FILTER_ERROR', msg, embed.id, {
        ip: meta?.ip,
        filterId,
        error: msg,
      });
      throw err;
    }
  }

  private validateEmbedToken(
    embed: { id: string; embedCode: string; embedSecret: string | null; dashboard: { userId: string } },
    token: string | undefined,
    userId: string,
    meta?: RequestMeta,
  ) {
    if (!token) {
      this.emitLog(userId, 'ERROR', 'JWT_MISSING', 'No token provided for JWT-secured embed', embed.id, {
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Token is required for this embed');
    }

    const secret = embed.embedSecret || env.EMBED_JWT_SECRET || env.JWT_SECRET;
    let payload: { embedCode?: string; type?: string };

    try {
      payload = this.jwt.verify(token, { secret }) as typeof payload;
    } catch (err) {
      const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
      const event = isExpired ? 'JWT_EXPIRED' : 'JWT_INVALID';
      const message = isExpired
        ? 'Embed token has expired'
        : 'Invalid embed token';
      this.emitLog(userId, 'ERROR', event, message, embed.id, {
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new UnauthorizedException(message);
    }

    if (payload.embedCode !== embed.embedCode) {
      this.emitLog(userId, 'ERROR', 'JWT_CODE_MISMATCH', 'Token embed code does not match', embed.id, {
        ip: meta?.ip,
        tokenEmbedCode: payload.embedCode,
        expectedEmbedCode: embed.embedCode,
      });
      throw new UnauthorizedException('Token does not match this embed');
    }
  }

  private async getFilterValuesInternal(
    filter: {
      id: string;
      field: string;
      collection: string;
      dataSourceId: string;
      parentFilterId: string | null;
      queryId: string | null;
    },
    page: number,
    pageSize: number,
    search?: string,
    parentValue?: unknown,
  ) {
    const fieldName = filter.field;
    const parsedParent =
      typeof parentValue === 'string' && parentValue.includes(',')
        ? parentValue.split(',')
        : parentValue;

    if (filter.queryId) {
      const injectedFilters: QueryFilter[] = [];
      if (parsedParent !== undefined && filter.parentFilterId) {
        const parent = await this.prisma.dashboardFilter.findUnique({
          where: { id: filter.parentFilterId },
        });
        if (parent) {
          injectedFilters.push({
            field: parent.field,
            operator: Array.isArray(parsedParent) ? 'in' : 'eq',
            value: parsedParent,
          });
        }
      }

      const result = await this.queries.executeInternal(
        filter.queryId,
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
      return { items: items.slice(skip, skip + pageSize), page, pageSize, total: items.length };
    }

    const ds = await this.dataSources.findOneInternal(filter.dataSourceId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const matchPipeline: object[] = [];

    if (parsedParent !== undefined && filter.parentFilterId) {
      const parent = await this.prisma.dashboardFilter.findUnique({
        where: { id: filter.parentFilterId },
      });
      if (parent) {
        matchPipeline.push({
          $match: {
            [parent.field]: Array.isArray(parsedParent)
              ? { $in: parsedParent }
              : parsedParent,
          },
        });
      }
    }

    if (search) {
      matchPipeline.push({
        $match: { [fieldName]: { $regex: search, $options: 'i' } },
      });
    }

    const skip = (page - 1) * pageSize;
    const valueGrouping = { $group: { _id: `$${fieldName}` } };

    const countResult = await db
      .collection(filter.collection)
      .aggregate([...matchPipeline, valueGrouping, { $count: 'total' }])
      .toArray();
    const total = countResult[0]?.total ?? 0;

    const results = await db
      .collection(filter.collection)
      .aggregate([
        ...matchPipeline,
        valueGrouping,
        { $sort: { _id: 1 } },
        { $skip: skip },
        { $limit: pageSize },
      ])
      .toArray();

    return {
      items: results
        .filter((r) => r._id !== null)
        .map((r) => ({ label: String(r._id), value: r._id })),
      page,
      pageSize,
      total,
    };
  }
}
