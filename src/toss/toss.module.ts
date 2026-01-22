import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TossPaymentsProvider } from './providers/toss-payments.provider';
import { PAYMENT_GATEWAY_TOKEN } from './interfaces/payment-gateway.interface';

/**
 * 토스페이먼츠 통합 모듈
 * - Provider 패턴으로 PG사 교체 용이
 * - 다른 모듈에서 import하여 사용
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    {
      provide: PAYMENT_GATEWAY_TOKEN,
      useClass: TossPaymentsProvider,
    },
  ],
  exports: [PAYMENT_GATEWAY_TOKEN],
})
export class TossModule {}
