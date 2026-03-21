import { Injectable } from '@nestjs/common';
import { Db } from 'mongodb';

export interface FieldSchema {
  name: string;
  type: string;
  nested?: FieldSchema[];
}

@Injectable()
export class MongoDBIntrospectionService {
  async listCollections(db: Db): Promise<string[]> {
    const collections = await db.listCollections().toArray();
    return collections.map((c) => c.name);
  }

  async inferSchema(db: Db, collection: string): Promise<FieldSchema[]> {
    const samples = await db
      .collection(collection)
      .aggregate([{ $sample: { size: 100 } }])
      .toArray();

    if (samples.length === 0) return [];

    const fieldTypes = new Map<string, Set<string>>();

    for (const doc of samples) {
      this.extractFields(doc, '', fieldTypes);
    }

    const fields: FieldSchema[] = [];
    for (const [path, types] of fieldTypes) {
      if (path.includes('.')) continue;
      fields.push({ name: path, type: this.resolveType(types) });
    }

    return fields.sort((a, b) => a.name.localeCompare(b.name));
  }

  private extractFields(
    obj: Record<string, unknown>,
    prefix: string,
    result: Map<string, Set<string>>,
  ) {
    for (const [key, value] of Object.entries(obj)) {
      if (key === '__v') continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const type = this.getType(value);
      if (!result.has(path)) result.set(path, new Set());
      result.get(path)!.add(type);
      if (type === 'object' && value !== null) {
        this.extractFields(value as Record<string, unknown>, path, result);
      }
    }
  }

  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') {
      if ('_bsontype' in value) return 'objectId';
      return 'object';
    }
    return typeof value;
  }

  private resolveType(types: Set<string>): string {
    const typeArr = [...types].filter((t) => t !== 'null');
    if (typeArr.length === 0) return 'null';
    if (typeArr.length === 1) return typeArr[0];
    if (typeArr.every((t) => ['number', 'string'].includes(t))) return 'string';
    return 'mixed';
  }
}
