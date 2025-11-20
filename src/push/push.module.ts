import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PushTestService } from './services/push-test.service';
import { PushTokenService } from './services/push-token.service';
import { PushNotificationService } from './services/push-notification.service';
import { PushTopicService } from './services/push-topic.service';
import { PushTestController } from './controllers/push-test.controller';
import { PushTokenController } from './controllers/push-token.controller';
import { PushNotificationController } from './controllers/push-notification.controller';
import { PushTopicController } from './controllers/push-topic.controller';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 푸시 알림 모듈
 *
 * FCM 푸시 알림 기능 제공
 */
@Module({
  imports: [FirebaseAdminModule],
  controllers: [
    PushTestController,
    PushTokenController,
    PushNotificationController,
    PushTopicController,
  ],
  providers: [
    FcmProvider,
    PushTestService,
    PushTokenService,
    PushNotificationService,
    PushTopicService,
    PrismaService,
  ],
  exports: [
    FcmProvider,
    PushTestService,
    PushTokenService,
    PushNotificationService,
    PushTopicService,
  ],
})
export class PushModule {}
