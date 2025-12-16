import { Module } from '@nestjs/common';
import { CouponController } from './controllers/coupon.controller';
import { CouponService } from './services/coupon.service';

/**
 * 쿠폰 모듈
 * 할인 쿠폰 관리 및 주문 시 쿠폰 적용 시스템
 */
@Module({
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponsModule {}