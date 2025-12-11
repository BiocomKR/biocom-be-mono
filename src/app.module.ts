import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { ConfigService } from '@nestjs/config';
import { QueuesModule } from './queues/queues.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Environment Variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // BullMQ Redis Connection
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // Bull Board - Queue 모니터링 UI
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),

    // Queues Module
    QueuesModule,

    // Health Check Module
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
