import { z } from 'zod';

export const saveAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  provider: z.string().default('google'),
  model: z.string().default('gemini-1.5-flash'),
});

export type SaveAIConfigDto = z.infer<typeof saveAIConfigSchema>;
