import { Module } from '@nestjs/common';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { EncryptionService } from '../../lib/crypto/encryption.service';
import { MongoDBService } from '../../lib/mongodb/mongodb.service';
import { MongoDBIntrospectionService } from '../../lib/mongodb/mongodb-introspection.service';

@Module({
  controllers: [DataSourcesController],
  providers: [DataSourcesService, EncryptionService, MongoDBService, MongoDBIntrospectionService],
  exports: [DataSourcesService, MongoDBService, MongoDBIntrospectionService, EncryptionService],
})
export class DataSourcesModule {}
