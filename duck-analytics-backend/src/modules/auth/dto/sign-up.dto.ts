import { z } from 'zod';
import { supportedLocaleSchema } from './auth-locale';

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  locale: supportedLocaleSchema.optional(),
});

export type SignUpDto = z.infer<typeof signUpSchema>;
