import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CouponService } from './coupon.service';

@ApiTags('쿠폰 관리')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /**
   * 쿠폰 목록 조회
   */
  @Get()
  async getCoupons(
    @Query('search') search?: string,
    @Query('discountType') discountType?: string,
    @Query('scopeType') scopeType?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.couponService.getCoupons({
      search,
      discountType,
      scopeType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * 쿠폰 통계 조회
   */
  @Get('stats')
  async getCouponStats() {
    return this.couponService.getCouponStats();
  }

  /**
   * 쿠폰 코드 중복 검사
   */
  @Get('check-code')
  async checkCodeDuplicate(
    @Query('code') code: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.couponService.checkCodeDuplicate(code, excludeId ? parseInt(excludeId) : undefined);
  }

  /**
   * 쿠폰 상세 조회
   */
  @Get(':id')
  async getCouponById(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.getCouponById(id);
  }

  /**
   * 쿠폰 생성
   */
  @Post()
  async createCoupon(@Body() dto: any) {
    return this.couponService.createCoupon(dto);
  }

  /**
   * 쿠폰 수정
   */
  @Put(':id')
  async updateCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.couponService.updateCoupon(id, dto);
  }

  /**
   * 쿠폰 삭제
   */
  @Delete(':id')
  async deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.deleteCoupon(id);
  }

  /**
   * 쿠폰 활성화/비활성화 토글
   */
  @Put(':id/toggle-active')
  async toggleCouponActive(@Param('id', ParseIntPipe) id: number) {
    return this.couponService.toggleCouponActive(id);
  }

  /**
   * 사용자 쿠폰 발급 내역 조회
   */
  @Get(':id/issued')
  async getIssuedCoupons(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.couponService.getIssuedCoupons(id, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }
}
