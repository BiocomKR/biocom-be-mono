import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentController, PaymentCallbackController } from './controllers/payment.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { PaymentService } from './services/payment.service';
import { WebhooksService } from './services/webhooks.service';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionSchedulerService } from './services/subscription-scheduler.service';
import { PlayautoModule } from '../playauto/playauto.module';
import { PAYMENT_GATEWAY_TOKEN } from './interfaces/payment-gateway.interface';
import { TossPaymentsProvider } from './providers/toss-payments.provider';

@Module({
  imports: [
    HttpModule,
    PlayautoModule
  ],
  controllers: [
    PaymentController,
    PaymentCallbackController,
    WebhooksController,
    SubscriptionController
  ],
  providers: [
    PaymentService,
    {
      provide: PAYMENT_GATEWAY_TOKEN,
      useClass: TossPaymentsProvider,
    },
    WebhooksService,
    SubscriptionService,
    SubscriptionSchedulerService,
  ],
  exports: [PaymentService, PAYMENT_GATEWAY_TOKEN, SubscriptionService]
})
export class PaymentModule {}