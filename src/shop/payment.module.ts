import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentController, PaymentCallbackController } from './controllers/payment.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { PaymentService } from './services/payment.service';
import { TossPaymentsService } from './services/toss-payments.service';
import { WebhooksService } from './services/webhooks.service';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionSchedulerService } from './services/subscription-scheduler.service';
import { PlayautoModule } from '../playauto/playauto.module';

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
    TossPaymentsService,
    WebhooksService,
    SubscriptionService,
    SubscriptionSchedulerService,
  ],
  exports: [PaymentService, TossPaymentsService, SubscriptionService]
})
export class PaymentModule {}