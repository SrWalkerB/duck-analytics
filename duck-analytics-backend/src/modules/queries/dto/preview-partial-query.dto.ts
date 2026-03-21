import { z } from 'zod';

export const previewPartialQuerySchema = z.object({
  dataSourceId: z.string(),
  collection: z.string().min(1),
  configuration: z.object({
    version: z.literal(2),
    stages: z.array(z.record(z.string(), z.unknown())),
  }),
  upToStageId: z.string(),
});

export type PreviewPartialQueryDto = z.infer<typeof previewPartialQuerySchema>;
