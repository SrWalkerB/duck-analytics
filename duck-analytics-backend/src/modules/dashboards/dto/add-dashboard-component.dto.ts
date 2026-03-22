import { z } from 'zod';

export const addDashboardComponentSchema = z.object({
  componentId: z.string(),
  x: z.number().default(0),
  y: z.number().default(0),
  w: z.number().default(6),
  h: z.number().default(4),
  title: z.string().optional(),
  backgroundColor: z.string().optional(),
  tabId: z.string().optional(),
});

export type AddDashboardComponentDto = z.infer<
  typeof addDashboardComponentSchema
>;
