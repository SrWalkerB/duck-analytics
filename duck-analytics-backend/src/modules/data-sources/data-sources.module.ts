import { Module } from '@nestjs/common';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { DatabaseModule } from '../../lib/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService, DatabaseModule],
})
export class DataSourcesModule {}
