import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  providers: [SubscriptionService, PrismaService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
