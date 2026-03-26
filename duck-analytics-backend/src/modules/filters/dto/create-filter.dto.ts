import { z } from 'zod';
import { FilterType } from '../../../generated/prisma/enums';

export const createFilterSchema = z.object({
  label: z.string().min(1),
  type: z.nativeEnum(FilterType).default(FilterType.SELECT),
  field: z.string().min(1),
  collection: z.string().min(1),
  dataSourceId: z.string(),
  parentFilterId: z.string().optional(),
  targetMappings: z.array(z.object({
    componentId: z.string(),
    targetField: z.string(),
    valueField: z.string().optional(),
    fieldType: z.string().optional(),
  })).default([]),
  queryId: z.string().optional(),
});

export type CreateFilterDto = z.infer<typeof createFilterSchema>;
