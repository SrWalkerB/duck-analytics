import { z } from 'zod';

export const generateComponentSchema = z.object({
  dataSourceId: z.string(),
  collection: z.string(),
  prompt: z.string().min(1),
});

export type GenerateComponentDto = z.infer<typeof generateComponentSchema>;
