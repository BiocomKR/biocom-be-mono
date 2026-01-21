import { Module } from '@nestjs/common';
import { IapController } from './iap.controller';
import { IapService } from './services/iap.service';
import { AppleIapService } from './services/apple-iap.service';
import { GoogleIapService } from './services/google-iap.service';
import { IapSchedulerService } from './services/iap-scheduler.service';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';

@Module({
  controllers: [IapController],
  providers: [
    IapService,
    AppleIapService,
    GoogleIapService,
    IapSchedulerService,
    PrismaService,
    ConfigService,
  ],
  exports: [IapService, IapSchedulerService],
})
export class IapModule {}
