import { z } from 'zod';
import { createFilterSchema } from './create-filter.dto';

export const updateFilterSchema = createFilterSchema.partial();
export type UpdateFilterDto = z.infer<typeof updateFilterSchema>;
