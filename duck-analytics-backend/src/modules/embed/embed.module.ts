import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmbedController } from './embed.controller';
import { EmbedService } from './embed.service';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { ComponentsModule } from '../components/components.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { QueriesModule } from '../queries/queries.module';
import { env } from '../../env';

@Module({
  imports: [
    DashboardsModule,
    ComponentsModule,
    DataSourcesModule,
    QueriesModule,
    JwtModule.register({
      secret: env.EMBED_JWT_SECRET || env.JWT_SECRET,
    }),
  ],
  controllers: [EmbedController],
  providers: [EmbedService],
})
export class EmbedModule {}
