import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PushTestService } from './services/push-test.service';
import { PushTokenService } from './services/push-token.service';
import { PushNotificationService } from './services/push-notification.service';
import { PushTopicService } from './services/push-topic.service';
import { PushScheduleService } from './services/push-schedule.service';
import { PushCampaignService } from './services/push-campaign.service';
import { PushSchedulerService } from './services/push-scheduler.service';
import { PushTestController } from './controllers/push-test.controller';
import { PushTokenController } from './controllers/push-token.controller';
import { PushNotificationController } from './controllers/push-notification.controller';
import { PushNotificationAdminController } from './controllers/push-notification-admin.controller';
import { PushTopicController } from './controllers/push-topic.controller';
import { PushScheduleController } from './controllers/push-schedule.controller';
import { PushCampaignController } from './controllers/push-campaign.controller';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 푸시 알림 모듈
 *
 * FCM 푸시 알림 기능 제공
 * - 실시간 푸시 전송
 * - 스케줄링 푸시 (ONCE/RECURRING)
 * - 캠페인 관리
 */
@Module({
  imports: [
    FirebaseAdminModule,
    ScheduleModule.forRoot(), // 크론잡 활성화
  ],
  controllers: [
    PushTestController,
    PushTokenController,
    PushNotificationController,
    PushNotificationAdminController,
    PushTopicController,
    PushScheduleController,
    PushCampaignController,
  ],
  providers: [
    FcmProvider,
    PushTestService,
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PushScheduleService,
    PushCampaignService,
    PushSchedulerService,
    PrismaService,
  ],
  exports: [
    FcmProvider,
    PushTestService,
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PushScheduleService,
    PushCampaignService,
  ],
})
export class PushModule {}
