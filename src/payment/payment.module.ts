import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TossPaymentsService } from './toss-payments.service';

@Module({
  imports: [HttpModule],
  controllers: [PaymentController],
  providers: [PaymentService, TossPaymentsService],
  exports: [PaymentService]
})
export class PaymentModule {}