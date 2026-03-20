import { z } from 'zod';
import { createComponentSchema } from './create-component.dto';

export const updateComponentSchema = createComponentSchema.partial();
export type UpdateComponentDto = z.infer<typeof updateComponentSchema>;
