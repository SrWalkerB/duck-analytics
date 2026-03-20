import { Module } from '@nestjs/common';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './components.service';
import { QueriesModule } from '../queries/queries.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [QueriesModule, DataSourcesModule],
  controllers: [ComponentsController],
  providers: [ComponentsService],
  exports: [ComponentsService],
})
export class ComponentsModule {}
