import { Injectable, NotFoundException } from '@nestjs/common';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { EncryptionService } from '../../lib/crypto/encryption.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { QueriesService } from '../queries/queries.service';
import { ComponentsService } from '../components/components.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import type { SaveAIConfigDto } from './dto/save-ai-config.dto';
import type { GenerateDashboardDto } from './dto/generate-dashboard.dto';
import type { GenerateComponentDto } from './dto/generate-component.dto';

const generatedDashboardSchema = z.object({
  dashboardName: z.string(),
  queries: z.array(
    z.object({
      name: z.string(),
      collection: z.string(),
      configuration: z.record(z.string(), z.unknown()),
    }),
  ),
  components: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['TABLE', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'KPI']),
      queryIndex: z.number(),
      configuration: z.record(z.string(), z.unknown()),
    }),
  ),
  gridPositions: z.array(
    z.object({
      componentIndex: z.number(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  ),
});

export type GeneratedDashboard = z.infer<typeof generatedDashboardSchema>;

@Injectable()
export class AIService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly dataSources: DataSourcesService,
    private readonly queries: QueriesService,
    private readonly components: ComponentsService,
    private readonly dashboards: DashboardsService,
  ) {}

  async getConfig(userId: string) {
    const config = await this.prisma.aIConfig.findUnique({
      where: { userId },
      select: { provider: true, model: true, createdAt: true, updatedAt: true },
    });
    return config;
  }

  async saveConfig(userId: string, dto: SaveAIConfigDto) {
    const encrypted = this.encryption.encrypt(dto.apiKey);
    return this.prisma.aIConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: dto.provider ?? 'google',
        encryptedApiKey: encrypted,
        model: dto.model ?? 'gemini-1.5-flash',
      },
      update: {
        provider: dto.provider ?? 'google',
        encryptedApiKey: encrypted,
        model: dto.model ?? 'gemini-1.5-flash',
      },
      select: { provider: true, model: true },
    });
  }

  async deleteConfig(userId: string) {
    return this.prisma.aIConfig.delete({ where: { userId } });
  }

  async generateDashboard(userId: string, dto: GenerateDashboardDto) {
    const config = await this.prisma.aIConfig.findUnique({ where: { userId } });
    if (!config)
      throw new NotFoundException(
        'AI config not found. Set your API key in Settings.',
      );

    const apiKey = this.encryption.decrypt(config.encryptedApiKey);
    const schema = await this.dataSources.getCollections(
      dto.dataSourceId,
      userId,
    );
    const collectionSchemas: Record<string, unknown> = {};

    for (const col of schema.collections.slice(0, 10)) {
      try {
        const s = await this.dataSources.getCollectionSchema(
          dto.dataSourceId,
          col,
          userId,
        );
        collectionSchemas[col] = s.fields;
      } catch {
        collectionSchemas[col] = [];
      }
    }

    const systemPrompt = `You are a data analytics assistant.
Given a MongoDB data source schema, generate a dashboard configuration.
Available collections and their fields:
${JSON.stringify(collectionSchemas, null, 2)}

Rules:
- Generate meaningful queries using the available collections and fields
- Choose appropriate chart types: TABLE for raw data, BAR_CHART for comparisons, LINE_CHART for trends, PIE_CHART for distributions, KPI for single metrics
- Grid uses 12 columns. Position components in a visually pleasing layout.
- configuration for queries should match: { filters, aggregations, groupBy, sort, limit, projections }
- KPI components should aggregate a single number metric`;

    const google = createGoogleGenerativeAI({ apiKey });

    const { object } = await generateObject({
      model: google(config.model),
      schema: generatedDashboardSchema,
      system: systemPrompt,
      prompt: dto.prompt,
    });

    return { preview: object, dataSourceId: dto.dataSourceId };
  }

  async generateComponent(userId: string, dto: GenerateComponentDto) {
    const config = await this.prisma.aIConfig.findUnique({ where: { userId } });
    if (!config)
      throw new NotFoundException(
        'AI config not found. Set your API key in Settings.',
      );

    const apiKey = this.encryption.decrypt(config.encryptedApiKey);
    const schema = await this.dataSources.getCollectionSchema(
      dto.dataSourceId,
      dto.collection,
      userId,
    );
    const allCollections = await this.dataSources.getCollections(
      dto.dataSourceId,
      userId,
    );

    const systemPrompt = `You are a data analytics assistant for MongoDB.
Generate a single component configuration for the collection "${dto.collection}".

Collection fields (name → type):
${schema.fields.map((f) => `  ${f.name}: ${f.type}`).join('\n')}

Other available collections for lookups: ${allCollections.collections.filter((c) => c !== dto.collection).join(', ')}

Rules:
- configuration must follow: { filters, aggregations, groupBy, sort, limit, lookups }
- lookups: [{ from, localField, foreignField, as, unwind }]
- aggregations: [{ field, function (SUM|AVG|COUNT|MIN|MAX|COUNT_DISTINCT), alias }]
- filters: [{ field, operator (eq|ne|gt|gte|lt|lte|in|nin|regex|exists), value }]
- vizType: TABLE | BAR_CHART | LINE_CHART | PIE_CHART | KPI
- xField and yField must be column names that will appear in the query result
- For KPI, set yField to the metric alias and leave xField empty
- Keep it simple and practical`;

    const componentSchema = z.object({
      name: z.string(),
      vizType: z.enum(['TABLE', 'BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'KPI']),
      configuration: z.record(z.string(), z.unknown()),
      xField: z.string().optional(),
      yField: z.string().optional(),
      vizLabel: z.string().optional(),
    });

    const google = createGoogleGenerativeAI({ apiKey });
    const { object } = await generateObject({
      model: google(config.model),
      schema: componentSchema,
      system: systemPrompt,
      prompt: dto.prompt,
    });

    return object;
  }

  async applyGeneratedDashboard(
    userId: string,
    dataSourceId: string,
    preview: GeneratedDashboard,
  ) {
    const createdQueryIds: string[] = [];
    const createdComponentIds: string[] = [];

    for (const q of preview.queries) {
      const query = await this.queries.create(userId, {
        name: q.name,
        dataSourceId,
        collection: q.collection,
        configuration: q.configuration,
      });
      createdQueryIds.push(query.id);
    }

    for (const c of preview.components) {
      const queryId = createdQueryIds[c.queryIndex];
      const component = await this.components.create(userId, {
        name: c.name,
        type: c.type,
        queryId,
        configuration: c.configuration,
      });
      createdComponentIds.push(component.id);
    }

    const dashboard = await this.dashboards.create(userId, {
      name: preview.dashboardName,
      configuration: {},
    });

    for (const pos of preview.gridPositions) {
      const componentId = createdComponentIds[pos.componentIndex];
      if (componentId) {
        await this.dashboards.addComponent(dashboard.id, userId, {
          componentId,
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
        });
      }
    }

    return { dashboardId: dashboard.id };
  }
}
