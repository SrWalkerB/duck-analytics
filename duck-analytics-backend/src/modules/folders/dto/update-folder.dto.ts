import { z } from 'zod';
import { createFolderSchema } from './create-folder.dto';

export const updateFolderSchema = createFolderSchema.partial();
export type UpdateFolderDto = z.infer<typeof updateFolderSchema>;
