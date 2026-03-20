import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.folder.findMany({
      where: { userId, deletedAt: null },
      include: { children: { where: { deletedAt: null } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const f = await this.prisma.folder.findFirst({ where: { id, userId, deletedAt: null } });
    if (!f) throw new NotFoundException('Folder not found');
    return f;
  }

  async create(userId: string, dto: CreateFolderDto) {
    return this.prisma.folder.create({ data: { name: dto.name, userId, parentId: dto.parentId } });
  }

  async update(id: string, userId: string, dto: UpdateFolderDto) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async move(id: string, userId: string, parentId: string | null) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({ where: { id }, data: { parentId } });
  }
}
