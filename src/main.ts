import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4001);

  await app.listen(port);

  logger.log(`🚀 biocom-mq Worker is running on http://localhost:${port}`);
  logger.log(`📊 Bull Board: http://localhost:${port}/admin/queues`);
  logger.log(`🔍 Health Check: http://localhost:${port}/health`);
}

bootstrap();
