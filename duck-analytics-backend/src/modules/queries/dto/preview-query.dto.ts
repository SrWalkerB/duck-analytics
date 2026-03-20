import { z } from 'zod';

export const previewQuerySchema = z.object({
  dataSourceId: z.string(),
  collection: z.string().min(1),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export type PreviewQueryDto = z.infer<typeof previewQuerySchema>;
