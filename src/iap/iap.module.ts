import { Module } from '@nestjs/common';
import { IapController } from './iap.controller';
import { WebhookController } from './webhook.controller';
import { IapService } from './services/iap.service';
import { AppleIapService } from './services/apple-iap.service';
import { GoogleIapService } from './services/google-iap.service';
import { WebhookService } from './services/webhook.service';
import { IapSchedulerService } from './services/iap-scheduler.service';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';

@Module({
  controllers: [IapController, WebhookController],
  providers: [
    IapService,
    AppleIapService,
    GoogleIapService,
    WebhookService,
    IapSchedulerService,
    PrismaService,
    ConfigService,
  ],
  exports: [IapService, IapSchedulerService],
})
export class IapModule {}
