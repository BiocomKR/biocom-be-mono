import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from './firebase-admin.module';
import { FcmProvider } from './providers/fcm.provider';
import { PushTestService } from './services/push-test.service';
import { PushTestController } from './controllers/push-test.controller';

/**
 * 푸시 알림 모듈
 *
 * FCM 푸시 알림 기능 제공
 */
@Module({
  imports: [FirebaseAdminModule],
  controllers: [PushTestController],
  providers: [FcmProvider, PushTestService],
  exports: [FcmProvider, PushTestService],
})
export class PushModule {}
