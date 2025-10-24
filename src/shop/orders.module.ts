import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { CouponsModule } from '../coupons/coupons.module';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';

@Module({
  imports: [PointModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
