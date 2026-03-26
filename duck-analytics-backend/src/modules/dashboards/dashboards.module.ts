import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { ComponentsModule } from '../components/components.module';
import { QueriesModule } from '../queries/queries.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [ComponentsModule, QueriesModule, DataSourcesModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
