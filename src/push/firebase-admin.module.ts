import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

/**
 * Firebase Admin SDK 글로벌 모듈 (MQ Worker용)
 *
 * Firebase Cloud Messaging (FCM) 사용을 위한 Admin SDK 초기화
 */
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (configService: ConfigService) => {
        const serviceAccountPath = configService.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_PATH',
          './biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json',
        );

        try {
          if (!admin.apps.length) {
            const path = require('path');
            const fs = require('fs');
            const serviceAccountFullPath = path.resolve(
              process.cwd(),
              serviceAccountPath,
            );

            if (!fs.existsSync(serviceAccountFullPath)) {
              console.warn(
                '⚠️  Firebase 서비스 계정 키 파일을 찾을 수 없습니다:',
                serviceAccountFullPath,
              );
              console.warn('⚠️  푸시 알림 기능이 비활성화됩니다.');
              return null;
            }

            const serviceAccount = require(serviceAccountFullPath);

            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });

            console.log('✅ [MQ] Firebase Admin SDK 초기화 완료');
          }

          return admin;
        } catch (error) {
          console.error('❌ [MQ] Firebase Admin SDK 초기화 실패:', error);
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseAdminModule {}
