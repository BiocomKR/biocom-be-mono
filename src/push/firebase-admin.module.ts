import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

/**
 * Firebase Admin SDK 글로벌 모듈
 *
 * Firebase Cloud Messaging (FCM) 사용을 위한 Admin SDK 초기화
 * @Global 데코레이터로 앱 전체에서 사용 가능
 */
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (configService: ConfigService) => {
        // Firebase Service Account JSON 파일 경로
        const serviceAccountPath = configService.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_PATH',
          './biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json',
        );

        try {
          // Firebase Admin SDK 초기화 (이미 초기화되었으면 스킵)
          if (!admin.apps.length) {
            const path = require('path');
            const serviceAccountFullPath = path.resolve(
              process.cwd(),
              serviceAccountPath,
            );
            const serviceAccount = require(serviceAccountFullPath);

            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });

            console.log('✅ Firebase Admin SDK 초기화 완료');
          }

          return admin;
        } catch (error) {
          console.error('❌ Firebase Admin SDK 초기화 실패:', error);
          throw error;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseAdminModule {}
