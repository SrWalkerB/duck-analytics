import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { QueriesModule } from '../queries/queries.module';
import { ComponentsModule } from '../components/components.module';
import { DashboardsModule } from '../dashboards/dashboards.module';

@Module({
  imports: [DataSourcesModule, QueriesModule, ComponentsModule, DashboardsModule],
  controllers: [AIController],
  providers: [AIService],
})
export class AIModule {}
