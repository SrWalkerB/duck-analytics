import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:5174', credentials: true });
  await app.listen(env.PORT);
  console.log(`Duck Analytics API running on port ${env.PORT}`);
}

bootstrap();
