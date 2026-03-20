import { z } from 'zod';

export const applyDashboardSchema = z.object({
  dataSourceId: z.string(),
  preview: z.record(z.string(), z.unknown()),
});

export type ApplyDashboardDto = z.infer<typeof applyDashboardSchema>;
