import { z } from 'zod';
import { FilterType } from '../../../generated/prisma/enums';

export const createFilterSchema = z.object({
  label: z.string().min(1),
  type: z.nativeEnum(FilterType).default(FilterType.SELECT),
  field: z.string().min(1),
  collection: z.string().min(1),
  dataSourceId: z.string(),
  parentFilterId: z.string().optional(),
  targetComponentIds: z.array(z.string()).default([]),
});

export type CreateFilterDto = z.infer<typeof createFilterSchema>;
