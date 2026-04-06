import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './lib/prisma/prisma.module';
import { LogsModule } from './lib/logs/logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { QueriesModule } from './modules/queries/queries.module';
import { ComponentsModule } from './modules/components/components.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { FiltersModule } from './modules/filters/filters.module';
import { FoldersModule } from './modules/folders/folders.module';
import { AIModule } from './modules/ai/ai.module';
import { EmbedModule } from './modules/embed/embed.module';
import { LogsControllerModule } from './modules/logs/logs.module';
import { env } from './env';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.RATE_LIMIT_TTL,
        limit: env.RATE_LIMIT_LIMIT,
      },
    ]),
    PrismaModule,
    LogsModule,
    AuthModule,
    DataSourcesModule,
    QueriesModule,
    ComponentsModule,
    DashboardsModule,
    FiltersModule,
    FoldersModule,
    AIModule,
    EmbedModule,
    LogsControllerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
