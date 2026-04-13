import { z } from 'zod';

export const createDataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['MONGODB', 'POSTGRESQL']).default('MONGODB'),
  connectionString: z.string().min(1),
  database: z.string().min(1),
  folderId: z.string().optional(),
});

export type CreateDataSourceDto = z.infer<typeof createDataSourceSchema>;
