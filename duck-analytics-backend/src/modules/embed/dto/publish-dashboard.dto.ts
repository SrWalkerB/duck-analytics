import { z } from 'zod';

export const publishDashboardSchema = z.object({
  embedType: z.enum(['PUBLIC', 'JWT_SECURED']),
  showFilters: z.boolean().default(true),
  showTitle: z.boolean().default(true),
});

export type PublishDashboardDto = z.infer<typeof publishDashboardSchema>;
