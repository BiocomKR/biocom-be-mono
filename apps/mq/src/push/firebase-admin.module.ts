import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Firebase 앱 인스턴스 맵
 * bundleId 기반으로 올바른 Firebase 앱 선택
 */
export interface FirebaseApps {
  dev: admin.app.App | null;
  prod: admin.app.App | null;
  getAppForBundleId: (bundleId: string) => admin.app.App | null;
}

/**
 * Firebase Admin SDK 글로벌 모듈 (MQ Worker용)
 *
 * Dev/Prod 두 개의 Firebase 앱 인스턴스를 초기화하여
 * bundleId에 따라 올바른 FCM credential 사용
 */
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_APPS',
      useFactory: (configService: ConfigService): FirebaseApps => {
        const devCredentialPath = configService.get<string>(
          'FIREBASE_DEV_CREDENTIAL_PATH',
          './biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json',
        );
        const prodCredentialPath = configService.get<string>(
          'FIREBASE_PROD_CREDENTIAL_PATH',
          './biocomchallenge-firebase-adminsdk-fbsvc-6e2824f3ee.json',
        );

        let devApp: admin.app.App | null = null;
        let prodApp: admin.app.App | null = null;

        // Dev Firebase 앱 초기화
        try {
          const devFullPath = path.resolve(process.cwd(), devCredentialPath);
          if (fs.existsSync(devFullPath)) {
            const existingDevApp = admin.apps.find((app) => app?.name === 'dev');
            if (existingDevApp) {
              devApp = existingDevApp;
            } else {
              const serviceAccount = require(devFullPath);
              devApp = admin.initializeApp(
                { credential: admin.credential.cert(serviceAccount) },
                'dev',
              );
            }
            console.log('✅ [MQ] Firebase Dev 앱 초기화 완료');
          } else {
            console.warn('⚠️  [MQ] Firebase Dev 키 파일 없음:', devFullPath);
          }
        } catch (error) {
          console.error('❌ [MQ] Firebase Dev 앱 초기화 실패:', error);
        }

        // Prod Firebase 앱 초기화
        try {
          const prodFullPath = path.resolve(process.cwd(), prodCredentialPath);
          if (fs.existsSync(prodFullPath)) {
            const existingProdApp = admin.apps.find((app) => app?.name === 'prod');
            if (existingProdApp) {
              prodApp = existingProdApp;
            } else {
              const serviceAccount = require(prodFullPath);
              prodApp = admin.initializeApp(
                { credential: admin.credential.cert(serviceAccount) },
                'prod',
              );
            }
            console.log('✅ [MQ] Firebase Prod 앱 초기화 완료');
          } else {
            console.warn('⚠️  [MQ] Firebase Prod 키 파일 없음:', prodFullPath);
          }
        } catch (error) {
          console.error('❌ [MQ] Firebase Prod 앱 초기화 실패:', error);
        }

        return {
          dev: devApp,
          prod: prodApp,
          getAppForBundleId: (bundleId: string): admin.app.App | null => {
            // bundleId에 .dev가 포함되면 dev 앱 사용
            if (bundleId?.includes('.dev')) {
              return devApp;
            }
            // 그 외는 prod 앱 사용
            return prodApp;
          },
        };
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_APPS'],
})
export class FirebaseAdminModule {}
