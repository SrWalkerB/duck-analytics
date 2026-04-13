import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller';
import { QueriesService } from './queries.service';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [DataSourcesModule],
  controllers: [QueriesController],
  providers: [QueriesService],
  exports: [QueriesService, DataSourcesModule],
})
export class QueriesModule {}
