import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
});

export type CreateFolderDto = z.infer<typeof createFolderSchema>;
