import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_INTERCEPTOR, APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { PrismaService } from './common/services/prisma.service';
import { ConfigService } from './common/services/config.service';
import { LoggerService } from './common/services/logger.service';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { LoggerModule } from './common/modules/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { throttlerConfig } from './common/config/throttler.config';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { HealthModule } from './health/health.module';
import { validationSchema, configuration } from './common/config/env.validation';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { ImwebModule } from './imweb/imweb.module';
import { MissionModule } from './mission/mission.module';
import { SurveyModule } from './survey/survey.module';
import { ChallengeModule } from './challenge/challenge.module';
import { ManagementModule } from './management/management.module';
import { PointModule } from './point/point.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './shop/products.module';
import { CartModule } from './shop/cart.module';
import { OrdersModule } from './shop/orders.module';
import { PaymentModule } from './shop/payment.module';
import { ReviewsModule } from './shop/reviews.module';
import { RecordsModule } from './tracking/records.module';
import { StatisticsModule } from './tracking/statistics.module';
import { HomeModule } from './home/home.module';
import { BalanceGameModule } from './balance-game/balance-game.module';
import { CouponsModule } from './coupons/coupons.module';
import { AiCharacterModule } from './ai-character/ai-character.module';

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
    UsersModule,      // 사용자 관리 모듈 (V2 방식)
    ImwebModule,      // 아임웹 API 통합 모듈
    MissionModule,    // 미션 모듈
    SurveyModule,     // 설문 모듈
    ChallengeModule,  // 챌린지 관리 모듈
    ManagementModule, // 백오피스 관리 모듈
    PointModule,      // 포인트 관리 모듈
    CategoriesModule, // 카테고리 관리 모듈
    ProductsModule,   // 상품 관리 모듈
    CartModule,       // 장바구니 모듈
    OrdersModule,     // 주문 관리 모듈
    PaymentModule,    // 결제 연동 모듈
    ReviewsModule,    // 상품 리뷰 모듈
    RecordsModule,    // 기록 관리 모듈
    StatisticsModule, // 통계 분석 모듈
    HomeModule,       // 홈 화면 모듈
    BalanceGameModule, // 밸런스게임 모듈
    CouponsModule,    // 쿠폰 관리 모듈
    AiCharacterModule, // AI 캐릭터 관리 모듈
  ],
  controllers: [], // 앱 레벨 컨트롤러 없음
  providers: [
    PrismaService,  // 글로벌 데이터베이스 서비스
    ConfigService,  // 타입 안전한 설정 서비스
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,  // 전역 로깅 인터셉터
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,  // 전역 Rate Limiting
    },
  ],
})
export class AppModule {}