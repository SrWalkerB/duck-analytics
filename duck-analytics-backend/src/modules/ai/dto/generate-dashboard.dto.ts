import { z } from 'zod';

export const generateDashboardSchema = z.object({
  dataSourceId: z.string(),
  prompt: z.string().min(1),
});

export type GenerateDashboardDto = z.infer<typeof generateDashboardSchema>;
