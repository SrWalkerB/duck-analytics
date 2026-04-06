import { z } from 'zod';

export const embedDataSchema = z.object({
  activeFilters: z.record(z.string(), z.array(z.unknown())).default({}),
});

export type EmbedDataDto = z.infer<typeof embedDataSchema>;
