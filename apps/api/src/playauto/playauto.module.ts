import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayautoProvider } from './providers/playauto.provider';
import { LOGISTICS_PROVIDER_TOKEN } from './interfaces/logistics-provider.interface';
import { ShippingSyncSchedulerService } from './services/shipping-sync-scheduler.service';
import { LogisticsRetrySchedulerService } from './services/logistics-retry-scheduler.service';

/**
 * 물류 서비스 모듈
 *
 * 플레이오토 물류 API 연동
 * - 주문 생성, 배송 추적, 주문 취소 기능 제공
 * - ILogisticsProvider 인터페이스로 서비스 교체 용이
 * - 배송 상태 동기화 스케줄러 (K8s CronJob)
 */
@Module({
  imports: [HttpModule],
  providers: [
    // 물류 Provider DI 토큰 설정 (플레이오토 → 다른 서비스 교체 용이)
    {
      provide: LOGISTICS_PROVIDER_TOKEN,
      useClass: PlayautoProvider,
    },
    PlayautoProvider, // 직접 주입 호환용
    ShippingSyncSchedulerService, // 배송 상태 동기화 배치
    LogisticsRetrySchedulerService, // 물류 주문 생성 재시도 배치
  ],
  exports: [
    LOGISTICS_PROVIDER_TOKEN,
    PlayautoProvider, // 직접 주입 호환용
    ShippingSyncSchedulerService, // main.ts에서 사용
    LogisticsRetrySchedulerService, // main.ts에서 사용
  ],
})
export class PlayautoModule {}
