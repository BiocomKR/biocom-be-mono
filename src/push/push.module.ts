import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PUSH_PROVIDER_TOKEN } from './interfaces/push-provider.interface';
import { PushTokenService } from './services/push-token.service';
import { PushNotificationService } from './services/push-notification.service';
import { PushTopicService } from './services/push-topic.service';
import { PushScheduleService } from './services/push-schedule.service';
import { PushCampaignService } from './services/push-campaign.service';
import { PushSchedulerService } from './services/push-scheduler.service';
import { PushSegmentService } from './services/push-segment.service';
import { PushTemplateService } from './services/push-template.service';
import { PushCampaignController } from './push-campaign.controller';
import { PushNotificationController } from './push-notification.controller';
import { PushScheduleController } from './push-schedule.controller';
import { PushPersonalizedController } from './push-personalized.controller';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 푸시 알림 모듈 (백오피스 전용)
 *
 * FCM 푸시 알림 관리 기능 제공
 * - 푸시 전송 (유저/전체)
 * - 스케줄링 푸시 (ONCE/RECURRING)
 * - 캠페인 관리
 * - 푸시 로그 조회
 * - 개인화 푸시 (세그먼트 + 템플릿)
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
    PushPersonalizedController,
  ],
  providers: [
    // 푸시 Provider DI 토큰 설정 (FCM → OneSignal 등 교체 용이)
    {
      provide: PUSH_PROVIDER_TOKEN,
      useClass: FcmProvider,
    },
    FcmProvider, // 기존 직접 주입 호환용 (점진적 마이그레이션)
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PushScheduleService,
    PushCampaignService,
    PushSchedulerService,
    PushSegmentService,
    PushTemplateService,
    PrismaService,
  ],
  exports: [
    PUSH_PROVIDER_TOKEN,
    FcmProvider, // 기존 직접 주입 호환용 (점진적 마이그레이션)
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PushScheduleService,
    PushCampaignService,
    PushSegmentService,
    PushTemplateService,
  ],
})
export class PushModule {}
