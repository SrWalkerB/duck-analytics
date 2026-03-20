import { z } from 'zod';

export const createDashboardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  configuration: z.record(z.string(), z.unknown()).default({}),
  folderId: z.string().optional(),
});

export type CreateDashboardDto = z.infer<typeof createDashboardSchema>;
