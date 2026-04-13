import { Module } from '@nestjs/common';
import { MongoDBService } from '../mongodb/mongodb.service';
import { MongoDBIntrospectionService } from '../mongodb/mongodb-introspection.service';
import { EncryptionService } from '../crypto/encryption.service';
import { QueryBuilderService } from '../../modules/queries/query-builder.service';
import { PostgreSQLService } from '../postgresql/postgresql.service';
import { PostgreSQLIntrospectionService } from '../postgresql/postgresql-introspection.service';
import { PostgreSQLQueryCompilerService } from '../postgresql/postgresql-query-compiler.service';
import { MongoDBAdapter } from './adapters/mongodb.adapter';
import { PostgreSQLAdapter } from './adapters/postgresql.adapter';
import { DatabaseAdapterFactory } from './database-adapter.factory';

@Module({
  providers: [
    // Shared
    EncryptionService,
    // MongoDB
    MongoDBService,
    MongoDBIntrospectionService,
    QueryBuilderService,
    MongoDBAdapter,
    // PostgreSQL
    PostgreSQLService,
    PostgreSQLIntrospectionService,
    PostgreSQLQueryCompilerService,
    PostgreSQLAdapter,
    // Factory
    DatabaseAdapterFactory,
  ],
  exports: [
    DatabaseAdapterFactory,
    QueryBuilderService,
    EncryptionService,
    MongoDBService,
    MongoDBIntrospectionService,
  ],
})
export class DatabaseModule {}
