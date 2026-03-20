import { z } from 'zod';
import { createDataSourceSchema } from './create-data-source.dto';

export const updateDataSourceSchema = createDataSourceSchema.partial();
export type UpdateDataSourceDto = z.infer<typeof updateDataSourceSchema>;
