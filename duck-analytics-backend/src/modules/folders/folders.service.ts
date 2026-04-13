import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';

interface CollectionItem {
  id: string;
  name: string;
  type: 'folder' | 'dashboard' | 'component';
  itemType?: string;
  updatedAt: Date;
  folderId: string | null;
}

interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderTreeNode[];
}

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
    const f = await this.prisma.folder.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!f) throw new NotFoundException('Folder not found');
    return f;
  }

  async create(userId: string, dto: CreateFolderDto) {
    return this.prisma.folder.create({
      data: { name: dto.name, userId, parentId: dto.parentId },
    });
  }

  async update(id: string, userId: string, dto: UpdateFolderDto) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async move(id: string, userId: string, parentId: string | null) {
    await this.findOne(id, userId);
    return this.prisma.folder.update({ where: { id }, data: { parentId } });
  }

  async getContents(folderId: string | null, userId: string) {
    const folder =
      folderId !== null ? await this.findOne(folderId, userId) : null;

    const breadcrumbs =
      folderId !== null ? await this.getBreadcrumbs(folderId, userId) : [];

    const [subFolders, dashboards, components] = await Promise.all([
      this.prisma.folder.findMany({
        where: { parentId: folderId, userId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.dashboard.findMany({
        where: { folderId, userId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.component.findMany({
        where: { folderId, userId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    ]);

    const items: CollectionItem[] = [
      ...subFolders.map((f) => ({
        id: f.id,
        name: f.name,
        type: 'folder' as const,
        updatedAt: f.updatedAt,
        folderId: f.parentId,
      })),
      ...dashboards.map((d) => ({
        id: d.id,
        name: d.name,
        type: 'dashboard' as const,
        updatedAt: d.updatedAt,
        folderId: d.folderId,
      })),
      ...components.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'component' as const,
        itemType: c.type,
        updatedAt: c.updatedAt,
        folderId: c.folderId,
      })),
    ];

    return { folder, breadcrumbs, items };
  }

  async getBreadcrumbs(
    folderId: string,
    userId: string,
  ): Promise<{ id: string; name: string }[]> {
    const crumbs: { id: string; name: string }[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: currentId, userId, deletedAt: null },
        select: { id: true, name: true, parentId: true },
      });
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return crumbs;
  }

  async getTree(userId: string): Promise<FolderTreeNode[]> {
    const allFolders = await this.prisma.folder.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    });

    const map = new Map<string, FolderTreeNode>();
    for (const f of allFolders) {
      map.set(f.id, {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        children: [],
      });
    }

    const roots: FolderTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
