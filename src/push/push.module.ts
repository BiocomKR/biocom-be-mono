import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PushTokenService } from './services/push-token.service';
import { PushNotificationService } from './services/push-notification.service';
import { PushTopicService } from './services/push-topic.service';
import { PushScheduleService } from './services/push-schedule.service';
import { PushCampaignService } from './services/push-campaign.service';
import { PushSchedulerService } from './services/push-scheduler.service';
import { PushCampaignController } from './push-campaign.controller';
import { PushNotificationController } from './push-notification.controller';
import { PushScheduleController } from './push-schedule.controller';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 푸시 알림 모듈 (백오피스 전용)
 *
 * FCM 푸시 알림 관리 기능 제공
 * - 푸시 전송 (유저/전체)
 * - 스케줄링 푸시 (ONCE/RECURRING)
 * - 캠페인 관리
 * - 푸시 로그 조회
 */
@Module({
  imports: [
    FirebaseAdminModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    PushCampaignController,
    PushNotificationController,
    PushScheduleController,
  ],
  providers: [
    FcmProvider,
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
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PushScheduleService,
    PushCampaignService,
  ],
})
export class PushModule {}
