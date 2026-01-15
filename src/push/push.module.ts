import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PUSH_PROVIDER_TOKEN } from './interfaces/push-provider.interface';
import { PushTokenService } from './services/push-token.service';
import { PushNotificationService } from './services/push-notification.service';
import { PushTopicService } from './services/push-topic.service';
// import { PushScheduleService } from './services/push-schedule.service'; // @deprecated - push-scheduler.service.ts로 통합됨
import { PushCampaignService } from './services/push-campaign.service';
import { PushSchedulerService } from './services/push-scheduler.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { PushTokenController } from './controllers/push-token.controller';
import { PushNotificationController } from './controllers/push-notification.controller';
import { PushTopicController } from './controllers/push-topic.controller';
import { PushTestController } from './controllers/push-test.controller';
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
    PushTokenController,
    PushNotificationController,
    PushTopicController,
    PushTestController,
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
    // PushScheduleService, // @deprecated - push-scheduler.service.ts로 통합됨
    PushCampaignService,
    PushSchedulerService,
    ConditionEvaluatorService,
    PrismaService,
  ],
  exports: [
    PUSH_PROVIDER_TOKEN,
    FcmProvider, // 기존 직접 주입 호환용 (점진적 마이그레이션)
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    // PushScheduleService, // @deprecated - push-scheduler.service.ts로 통합됨
    PushCampaignService,
    ConditionEvaluatorService,
  ],
})
export class PushModule {}
