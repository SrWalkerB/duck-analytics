import { z } from 'zod';
import { ComponentType } from '../../../generated/prisma/enums';

export const createComponentSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(ComponentType).default(ComponentType.TABLE),
  queryId: z.string(),
  configuration: z.record(z.string(), z.unknown()).default({}),
  folderId: z.string().optional(),
});

export type CreateComponentDto = z.infer<typeof createComponentSchema>;
