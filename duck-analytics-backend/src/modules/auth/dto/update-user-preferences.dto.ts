import { z } from 'zod';
import { supportedLocaleSchema } from './auth-locale';

export const updateUserPreferencesSchema = z.object({
  locale: supportedLocaleSchema,
});

export type UpdateUserPreferencesDto = z.infer<typeof updateUserPreferencesSchema>;
