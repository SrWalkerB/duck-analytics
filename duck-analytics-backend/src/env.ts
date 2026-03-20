import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  ENCRYPTION_KEY: z.string().length(64),
});

export const env = envSchema.parse(process.env);
