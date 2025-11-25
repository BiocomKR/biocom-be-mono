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
            const fs = require('fs');
            const serviceAccountFullPath = path.resolve(
              process.cwd(),
              serviceAccountPath,
            );

            // 파일이 존재하는지 확인
            if (!fs.existsSync(serviceAccountFullPath)) {
              console.warn(
                '⚠️  Firebase 서비스 계정 키 파일을 찾을 수 없습니다:',
                serviceAccountFullPath,
              );
              console.warn(
                '⚠️  푸시 알림 기능이 비활성화됩니다. 개발 환경에서는 정상입니다.',
              );
              // 빈 객체 반환 (앱은 정상 실행되도록)
              return null;
            }

            const serviceAccount = require(serviceAccountFullPath);

            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });

            console.log('✅ Firebase Admin SDK 초기화 완료');
          }

          return admin;
        } catch (error) {
          console.error('❌ Firebase Admin SDK 초기화 실패:', error);
          console.warn(
            '⚠️  푸시 알림 기능이 비활성화됩니다. 개발 환경에서는 정상입니다.',
          );
          // 에러를 던지지 않고 null 반환 (앱은 정상 실행되도록)
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseAdminModule {}
