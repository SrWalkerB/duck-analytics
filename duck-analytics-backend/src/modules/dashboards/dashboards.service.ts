import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ComponentsService } from '../components/components.service';
import type { CreateDashboardDto } from './dto/create-dashboard.dto';
import type { UpdateDashboardDto } from './dto/update-dashboard.dto';
import type { AddDashboardComponentDto } from './dto/add-dashboard-component.dto';
import type { UpdateLayoutDto } from './dto/update-layout.dto';

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly components: ComponentsService,
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const d = await this.prisma.dashboard.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        dashboardComponents: { include: { component: true } },
        dashboardFilters: true,
      },
    });
    if (!d) throw new NotFoundException('Dashboard not found');
    return d;
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
        data: { x: item.x, y: item.y, w: item.w, h: item.h },
      }),
    );
    await this.prisma.$transaction(updates);
    return { ok: true };
  }

  async getData(dashboardId: string, userId: string) {
    const dashboard = await this.findOne(dashboardId, userId);
    const results: Record<string, unknown> = {};
    await Promise.all(
      dashboard.dashboardComponents.map(async (dc) => {
        try {
          results[dc.id] = await this.components.getData(
            dc.componentId,
            userId,
          );
        } catch {
          results[dc.id] = { error: 'Failed to load data' };
        }
      }),
    );
    return results;
  }
}
