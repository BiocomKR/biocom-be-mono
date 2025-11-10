import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentModule } from './payment.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [PointModule, CouponsModule, PaymentModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
