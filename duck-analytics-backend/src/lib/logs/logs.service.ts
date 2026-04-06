import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LogLevel } from '../../generated/prisma';

interface LogParams {
  userId: string;
  level: LogLevel;
  source: string;
  event: string;
  resourceId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface FindAllOptions {
  source?: string;
  level?: string;
  event?: string;
  resourceId?: string;
  since?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget log — does not block the caller */
  log(params: LogParams): void {
    this.prisma.systemLog
      .create({ data: params })
      .catch((err) => console.error('[LogsService] Failed to write log:', err));
  }

  async findAll(userId: string, options: FindAllOptions = {}) {
    const { source, level, event, resourceId, since, page = 1, pageSize = 50 } = options;

    const where: Record<string, unknown> = { userId };
    if (source) where.source = source;
    if (level) where.level = level;
    if (event) where.event = event;
    if (resourceId) where.resourceId = resourceId;
    if (since) where.createdAt = { gte: since };

    const [data, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async clear(userId: string, source: string, resourceId?: string) {
    const where: Record<string, unknown> = { userId, source };
    if (resourceId) where.resourceId = resourceId;
    const { count } = await this.prisma.systemLog.deleteMany({ where });
    return { deleted: count };
  }
}
