import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import { TossPaymentsService } from './services/toss-payments.service';

@Module({
  imports: [HttpModule],
  controllers: [PaymentController],
  providers: [PaymentService, TossPaymentsService],
  exports: [PaymentService]
})
export class PaymentModule {}