import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PointModule],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
