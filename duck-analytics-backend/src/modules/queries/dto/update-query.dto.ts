import { z } from 'zod';
import { createQuerySchema } from './create-query.dto';

export const updateQuerySchema = createQuerySchema.partial();
export type UpdateQueryDto = z.infer<typeof updateQuerySchema>;
