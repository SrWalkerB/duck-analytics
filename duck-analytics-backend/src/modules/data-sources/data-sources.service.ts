import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { EncryptionService } from '../../lib/crypto/encryption.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { MongoDBIntrospectionService } from '../../lib/mongodb/mongodb-introspection.service';
import type { CreateDataSourceDto } from './dto/create-data-source.dto';
import type { UpdateDataSourceDto } from './dto/update-data-source.dto';

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly mongodb: MongoDBService,
    private readonly introspection: MongoDBIntrospectionService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.dataSource.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const ds = await this.prisma.dataSource.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!ds) throw new NotFoundException('Data source not found');
    return ds;
  }

  async findOneInternal(id: string) {
    const ds = await this.prisma.dataSource.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ds) throw new NotFoundException('Data source not found');
    return ds;
  }

  async create(userId: string, dto: CreateDataSourceDto) {
    const encrypted = this.encryption.encrypt(dto.connectionString);
    return this.prisma.dataSource.create({
      data: {
        name: dto.name,
        type: dto.type,
        connectionString: encrypted,
        database: dto.database,
        userId,
        folderId: dto.folderId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateDataSourceDto) {
    await this.findOne(id, userId);
    const data: Record<string, unknown> = { ...dto };
    if (dto.connectionString) {
      data.connectionString = this.encryption.encrypt(dto.connectionString);
    }
    return this.prisma.dataSource.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.dataSource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async testConnection(
    id: string,
    userId: string,
    overrides?: { connectionString?: string; database?: string },
  ) {
    const ds = await this.findOne(id, userId);
    const connectionString = overrides?.connectionString?.trim();
    const database = overrides?.database?.trim() || ds.database;

    if (connectionString) {
      await this.mongodb.testRawConnection(connectionString, database);
      return { ok: true };
    }

    await this.mongodb.testConnection(ds.connectionString, database);
    return { ok: true };
  }

  async testRawConnection(connectionString: string, database: string) {
    await this.mongodb.testRawConnection(connectionString, database);
    return { ok: true };
  }

  async getCollections(id: string, userId: string) {
    const ds = await this.findOne(id, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const collections = await this.introspection.listCollections(db);
    return { collections };
  }

  async getCollectionSchema(
    id: string,
    collectionName: string,
    userId: string,
  ) {
    const ds = await this.findOne(id, userId);
    const db = await this.mongodb.getDb(ds.connectionString, ds.database);
    const schema = await this.introspection.inferSchema(db, collectionName);
    return { collection: collectionName, fields: schema };
  }
}
