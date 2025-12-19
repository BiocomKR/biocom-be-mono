import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { join } from 'path';
import { ConfigService } from './common/services/config.service';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { LoggerModule } from './common/modules/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthModule } from './health/health.module';
import { validationSchema, configuration } from './common/config/env.validation';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { ImwebModule } from './imweb/imweb.module';
import { MissionModule } from './mission/mission.module';
import { SurveyModule } from './survey/survey.module';
import { ChallengeModule } from './challenge/challenge.module';
import { PointModule } from './point/point.module';
import { ProductsModule } from './shop/products.module';
import { CartModule } from './shop/cart.module';
import { OrdersModule } from './shop/orders.module';
import { PaymentModule } from './shop/payment.module';
import { ReviewsModule } from './shop/reviews.module';
import { QnaModule } from './shop/qna.module';
import { RecordsModule } from './tracking/records.module';
import { StatisticsModule } from './tracking/statistics.module';
import { HomeModule } from './home/home.module';
import { BalanceGameModule } from './balance-game/balance-game.module';
import { CouponsModule } from './coupons/coupons.module';
import { AiPersonaModule } from './ai-persona/ai-persona.module';
import { BannersModule } from './shop/banners.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { PushModule } from './push/push.module';
import { AppEventsModule } from './app-events/app-events.module';
import { ContentModule } from './content/content.module';
import { IapModule } from './iap/iap.module';
import { AppVersionModule } from './app-version/app-version.module';
import { PlayautoModule } from './playauto/playauto.module';
import { ConsentModule } from './consent/consent.module';
import { ExamModule } from './exam/exam.module';
import { QuizModule } from './quiz/quiz.module';
import { QueuesModule } from './queues/queues.module';
import { IssueModule } from './issue/issue.module';
import { EasUpdatesModule } from './eas-updates/eas-updates.module';

/**
 * 애플리케이션 루트 모듈
 * 전체 애플리케이션의 모듈 구조를 정의하고 관리
 * 
 * 포함 모듈:
 * - AuthModule: JWT 기반 인증 기능
 * - UploadModule: 파일 업로드 기능
 * - LoggerModule: Winston 기반 로깅
 * 
 * 글로벌 서비스:
 * - PrismaService: 데이터베이스 연결 관리
 * - LoggingInterceptor: HTTP 요청/응답 로깅
 */
@Module({
  imports: [
    // 환경변수 설정 (가장 먼저 로드)
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // 스케줄러 모듈 (Cron Job)
    ScheduleModule.forRoot(),


    // 정적 파일 서빙
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [{
        rootPath: configService.upload.path || join(__dirname, '..', '..', 'uploads'),
        serveRoot: '/uploads',
        // exclude 제거 - API 경로와 겹치지 않도록 /uploads 경로만 사용
      }],
      inject: [ConfigService],
    }),
    
    QueuesModule,     // BullMQ 큐 모듈 (Redis 연결 먼저)
    CommonModule,     // 공통 모듈 (글로벌)
    LoggerModule,     // 로깅 모듈 (글로벌)
    HealthModule,     // 헬스체크 모듈
    AuthModule,       // JWT 인증 모듈
    UploadModule,     // 파일 업로드 모듈
    UsersModule,      // 사용자 관리 모듈 (V2 방식)
    ImwebModule,      // 아임웹 API 통합 모듈
    MissionModule,    // 미션 모듈
    SurveyModule,     // 설문 모듈
    ChallengeModule,  // 챌린지 관리 모듈
    PointModule,      // 포인트 관리 모듈
    ProductsModule,   // 상품 관리 모듈
    BannersModule,    // 쇼핑몰 배너 모듈
    CartModule,       // 장바구니 모듈
    OrdersModule,     // 주문 관리 모듈
    PaymentModule,    // 결제 연동 모듈
    ReviewsModule,    // 상품 리뷰 모듈
    QnaModule,        // 상품 Q&A 모듈
    RecordsModule,    // 기록 관리 모듈
    StatisticsModule, // 통계 분석 모듈
    HomeModule,       // 홈 화면 모듈
    BalanceGameModule, // 밸런스게임 모듈
    CouponsModule,    // 쿠폰 관리 모듈
    AiPersonaModule, // AI 페르소나 관리 모듈
    PhoneVerificationModule, // 휴대폰 본인인증 모듈 (NHN KCP SMS 인증)
    PushModule,      // 푸시 알림 모듈 (FCM)
    AppEventsModule, // 앱 이벤트 수집 모듈 (GA4 대체/보조)
    ContentModule,   // 컨텐츠 관리 모듈
    IapModule,       // 인앱결제 모듈 (Apple/Google)
    AppVersionModule, // 앱 버전 관리 모듈
    PlayautoModule,  // 플레이오토 물류/배송 연동 모듈
    ConsentModule,    // 약관 관리 모듈
    ExamModule,       // 검사 결과 모듈
    QuizModule,       // 퀴즈 모듈
    IssueModule,      // 문제 신고 모듈
    EasUpdatesModule, // OTA 업데이트 모듈 (자체 호스팅)
  ],
  controllers: [], // 앱 레벨 컨트롤러 없음
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}