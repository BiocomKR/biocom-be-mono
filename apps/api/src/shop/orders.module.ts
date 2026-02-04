import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentModule } from './payment.module';
import { PlayautoModule } from '../playauto/playauto.module';
import { OrdersController } from './controllers/orders.controller';
import { InternalOrdersController } from './controllers/internal-orders.controller';
import { OrdersService } from './services/orders.service';
import { OrderSyncService } from './services/order-sync.service';

@Module({
  imports: [PointModule, CouponsModule, PaymentModule, PlayautoModule],
  controllers: [OrdersController, InternalOrdersController],
  providers: [OrdersService, OrderSyncService],
  exports: [OrdersService, OrderSyncService],
})
export class OrdersModule {}
