import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
  });
  await app.listen(env.PORT);
  console.log(`Duck Analytics API running on port ${env.PORT}`);
}

bootstrap();
