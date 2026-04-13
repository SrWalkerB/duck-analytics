import { Injectable } from '@nestjs/common';
import { MongoDBAdapter } from './adapters/mongodb.adapter';
import { PostgreSQLAdapter } from './adapters/postgresql.adapter';
import type { DatabaseAdapter } from './database-adapter.interface';

@Injectable()
export class DatabaseAdapterFactory {
  constructor(
    private readonly mongoAdapter: MongoDBAdapter,
    private readonly pgAdapter: PostgreSQLAdapter,
  ) {}

  getAdapter(type: string): DatabaseAdapter {
    switch (type) {
      case 'MONGODB':
        return this.mongoAdapter;
      case 'POSTGRESQL':
        return this.pgAdapter;
      default:
        throw new Error(`Unsupported data source type: ${type}`);
    }
  }
}
