import { z } from 'zod';

export const createQuerySchema = z.object({
  name: z.string().min(1),
  dataSourceId: z.string(),
  collection: z.string().min(1),
  configuration: z.record(z.string(), z.unknown()).default({}),
  folderId: z.string().optional(),
});

export type CreateQueryDto = z.infer<typeof createQuerySchema>;
