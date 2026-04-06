import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  ENCRYPTION_KEY: z.string().length(64),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174'),
  RATE_LIMIT_TTL: z.coerce.number().default(60_000),
  RATE_LIMIT_LIMIT: z.coerce.number().default(100),
  EMBED_JWT_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
