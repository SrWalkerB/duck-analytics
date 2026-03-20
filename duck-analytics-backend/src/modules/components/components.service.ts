import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { QueriesService } from '../queries/queries.service';
import type { CreateComponentDto } from './dto/create-component.dto';
import type { UpdateComponentDto } from './dto/update-component.dto';

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: QueriesService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.component.findMany({
      where: { userId, deletedAt: null },
      include: { query: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const c = await this.prisma.component.findFirst({
      where: { id, userId, deletedAt: null },
      include: { query: true },
    });
    if (!c) throw new NotFoundException('Component not found');
    return c;
  }

  async create(userId: string, dto: CreateComponentDto) {
    return this.prisma.component.create({
      data: {
        name: dto.name,
        type: dto.type,
        queryId: dto.queryId,
        configuration: dto.configuration as object,
        userId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateComponentDto) {
    await this.findOne(id, userId);
    return this.prisma.component.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration as object }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.component.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getData(id: string, userId: string) {
    const component = await this.findOne(id, userId);
    return this.queries.execute(component.queryId, userId);
  }
}
