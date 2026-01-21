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
import { ActivityLogInterceptor } from './common/interceptors/activity-log.interceptor';
import { HealthModule } from './health/health.module';
import { validationSchema, configuration } from './common/config/env.validation';
import { CommonModule } from './common/common.module';
import { TossModule } from './toss/toss.module';
import { ImwebModule } from './imweb/imweb.module';
import { PushModule } from './push/push.module';
import { ConsentModule } from './consent/consent.module';
import { OperatorsModule } from './operators/operators.module';
import { AppEventsModule } from './app-events/app-events.module';
import { AppVersionModule } from './app-version/app-version.module';
import { HealthTypeAnimalsModule } from './health-type-animals/health-type-animals.module';
import { QueuesModule } from './queues/queues.module';

// Domain Controllers
import { UsersController } from './users/users.controller';
import { ChallengeController } from './challenge/challenge.controller';
import { MissionController } from './mission/mission.controller';
import { SurveyController } from './survey/survey.controller';
import { ContentController } from './content/content.controller';
import { PointController } from './point/point.controller';
import { ShopController } from './shop/shop.controller';
import { FeedbackController } from './shop/feedback.controller';
import { ShippingController } from './shipping/shipping.controller';
import { RefundController } from './refund/refund.controller';
import { DashboardController } from './dashboard/dashboard.controller';
import { CartController } from './cart/cart.controller';
import { BannerController } from './banner/banner.controller';

// Domain Services
import { UsersService } from './users/users.service';
import { ChallengeService } from './challenge/challenge.service';
import { MissionService } from './mission/mission.service';
import { SurveyService } from './survey/survey.service';
import { ContentService } from './content/content.service';
import { PointService } from './point/point.service';
import { ShopService } from './shop/shop.service';
import { FeedbackService } from './shop/feedback.service';
import { ShippingService } from './shipping/shipping.service';
import { RefundService } from './refund/refund.service';
import { DashboardService } from './dashboard/dashboard.service';
import { CartService } from './cart/cart.service';
import { BannerService } from './banner/banner.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { UtilsModule } from './utils/utils.module';
import { IssueController } from './issue/issue.controller';
import { IssueService } from './issue/issue.service';
import { AppConfigModule } from './app-config/app-config.module';
import { RecordsModule } from './records/records.module';
import { SolutionController } from './solution/solution.controller';
import { SolutionService } from './solution/solution.service';
import { CouponController } from './coupon/coupon.controller';
import { CouponService } from './coupon/coupon.service';
import { PersonaModule } from './master/persona.module';
import { AnimalModule } from './master/animal.module';

/**
 * 애플리케이션 루트 모듈
 * 전체 애플리케이션의 모듈 구조를 정의하고 관리
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
      }],
      inject: [ConfigService],
    }),

    CommonModule,     // 공통 모듈 (글로벌)
    LoggerModule,     // 로깅 모듈 (글로벌)
    HealthModule,     // 헬스체크 모듈
    AuthModule,       // JWT 인증 모듈
    UploadModule,     // 파일 업로드 모듈
    TossModule,       // 토스페이먼츠 API 모듈
    ImwebModule,      // 아임웹 API 모듈
    PushModule,       // 푸시 알림 모듈
    ConsentModule,    // 약관 관리 모듈
    OperatorsModule,  // 운영자 관리 모듈
    AppEventsModule,  // 앱 이벤트 수집 모듈
    AppVersionModule, // 앱 버전 관리 모듈
    HealthTypeAnimalsModule, // 건강 타입 동물 관리 모듈
    QueuesModule,     // BullMQ 메시지 큐 모듈
    UtilsModule,      // 유틸리티 모듈 (이미지 변환 등)
    AppConfigModule,  // 앱 설정 관리 모듈
    RecordsModule,    // 기록 통계 모듈
    PersonaModule,    // 페르소나 관리 모듈
    AnimalModule,     // 동물 관리 모듈
  ],
  controllers: [
    UsersController,
    ChallengeController,
    MissionController,
    SurveyController,
    ContentController,
    PointController,
    ShopController,
    FeedbackController,
    ShippingController,
    RefundController,
    DashboardController,
    CartController,
    BannerController,
    OrdersController,
    IssueController,
    SolutionController,
    CouponController,
  ],
  providers: [
    UsersService,
    ChallengeService,
    MissionService,
    SurveyService,
    ContentService,
    PointService,
    ShopService,
    FeedbackService,
    ShippingService,
    RefundService,
    DashboardService,
    CartService,
    BannerService,
    OrdersService,
    IssueService,
    SolutionService,
    CouponService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule {}
