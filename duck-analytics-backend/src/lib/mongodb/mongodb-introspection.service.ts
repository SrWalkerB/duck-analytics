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
    return collections.map((c) => c.name).sort((a, b) => a.localeCompare(b));
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

    return this.buildTree(fieldTypes);
  }

  private buildTree(fieldTypes: Map<string, Set<string>>): FieldSchema[] {
    // Index nodes by full dot-path so we can attach children to parents.
    const nodes = new Map<string, FieldSchema>();

    // Sort by depth (shallower first), then alphabetically, so parents
    // always exist before children are attached.
    const paths = [...fieldTypes.keys()].sort((a, b) => {
      const da = a.split('.').length;
      const db = b.split('.').length;
      if (da !== db) return da - db;
      return a.localeCompare(b);
    });

    const roots: FieldSchema[] = [];

    for (const path of paths) {
      const types = fieldTypes.get(path)!;
      const node: FieldSchema = {
        name: path,
        type: this.resolveType(types),
      };
      nodes.set(path, node);

      const lastDot = path.lastIndexOf('.');
      if (lastDot === -1) {
        roots.push(node);
        continue;
      }

      const parentPath = path.slice(0, lastDot);
      const parent = nodes.get(parentPath);
      if (!parent) {
        // Orphan (shouldn't happen given depth sort), treat as root.
        roots.push(node);
        continue;
      }
      if (!parent.nested) parent.nested = [];
      parent.nested.push(node);
    }

    const sortTree = (list: FieldSchema[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
      for (const n of list) if (n.nested) sortTree(n.nested);
    };
    sortTree(roots);

    return roots;
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
