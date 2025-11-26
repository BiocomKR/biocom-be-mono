import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { PrismaService } from './common/services/prisma.service';
import { ConfigService } from './common/services/config.service';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { LoggerModule } from './common/modules/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { HealthModule } from './health/health.module';
import { validationSchema, configuration } from './common/config/env.validation';
import { CommonModule } from './common/common.module';
import { TossModule } from './toss/toss.module';
import { ImwebModule } from './imweb/imweb.module';
import { PushModule } from './push/push.module';
import { ConsentModule } from './consent/consent.module';

// Domain Controllers
import { UsersController } from './users/users.controller';
import { ChallengeController } from './challenge/challenge.controller';
import { MissionController } from './mission/mission.controller';
import { SurveyController } from './survey/survey.controller';
import { QuizMasterController } from './quiz/quiz-master.controller';
import { ContentController } from './content/content.controller';
import { PointController } from './point/point.controller';
import { ShopController } from './shop/shop.controller';
import { ShippingController } from './shipping/shipping.controller';
import { RefundController } from './refund/refund.controller';
import { DashboardController } from './dashboard/dashboard.controller';

// Domain Services
import { UsersService } from './users/users.service';
import { ChallengeService } from './challenge/challenge.service';
import { MissionService } from './mission/mission.service';
import { SurveyService } from './survey/survey.service';
import { QuizService } from './quiz/quiz.service';
import { ContentService } from './content/content.service';
import { PointService } from './point/point.service';
import { ShopService } from './shop/shop.service';
import { ShippingService } from './shipping/shipping.service';
import { RefundService } from './refund/refund.service';
import { DashboardService } from './dashboard/dashboard.service';

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

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: configService.rateLimit.ttl * 1000,
            limit: configService.rateLimit.limit,
          },
        ],
      }),
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
  ],
  controllers: [
    UsersController,
    ChallengeController,
    MissionController,
    SurveyController,
    QuizMasterController,
    ContentController,
    PointController,
    ShopController,
    ShippingController,
    RefundController,
    DashboardController,
  ],
  providers: [
    PrismaService,
    ConfigService,
    UsersService,
    ChallengeService,
    MissionService,
    SurveyService,
    QuizService,
    ContentService,
    PointService,
    ShopService,
    ShippingService,
    RefundService,
    DashboardService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
