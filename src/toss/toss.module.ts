import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TossPaymentsService } from './toss-payments.service';

/**
 * 토스페이먼츠 통합 모듈
 * - 다른 모듈에서 import하여 사용
 */
@Module({
  imports: [ConfigModule],
  providers: [TossPaymentsService],
  exports: [TossPaymentsService],
})
export class TossModule {}
