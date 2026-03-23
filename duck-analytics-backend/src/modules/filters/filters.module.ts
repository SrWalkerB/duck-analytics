import { Module } from '@nestjs/common';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { QueriesModule } from '../queries/queries.module';

@Module({
  imports: [DataSourcesModule, QueriesModule],
  controllers: [FiltersController],
  providers: [FiltersService],
})
export class FiltersModule {}
