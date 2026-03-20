import { Module } from '@nestjs/common';
import { PrismaModule } from './lib/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { QueriesModule } from './modules/queries/queries.module';
import { ComponentsModule } from './modules/components/components.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { FiltersModule } from './modules/filters/filters.module';
import { FoldersModule } from './modules/folders/folders.module';
import { AIModule } from './modules/ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DataSourcesModule,
    QueriesModule,
    ComponentsModule,
    DashboardsModule,
    FiltersModule,
    FoldersModule,
    AIModule,
  ],
})
export class AppModule {}
