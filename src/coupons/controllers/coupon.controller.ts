import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  ValidationPipe,
  Query
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { CouponService } from '../services/coupon.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  UserCouponListResponseDto,
  AvailableCouponsForProductResponseDto,
  UseCouponDto,
  UseCouponResponseDto,
  CouponValidationResponseDto,
  CouponDetailResponseDto
} from '../dto/coupon.dto';

@ApiTags('쇼핑몰 - 쿠폰')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /**
   * 사용자 보유 쿠폰 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '보유 쿠폰 목록 조회',
    description: '사용자가 보유한 모든 쿠폰을 조회합니다. 만료 시간과 상태 정보도 함께 반환됩니다.'
  })
  @ApiResponse({ status: 200, description: '성공', type: UserCouponListResponseDto })
  async getUserCoupons(@Req() req: any): Promise<UserCouponListResponseDto> {
    const userId = req.user.id;
    return this.couponService.getUserCoupons(userId);
  }

  /**
   * 특정 상품에 사용 가능한 쿠폰 조회
   */
  @Get('available/:productId')
  @ApiOperation({
    summary: '상품별 사용 가능한 쿠폰 조회',
    description: '특정 상품에 사용할 수 있는 쿠폰들과 예상 할인 금액을 조회합니다.'
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '성공', type: AvailableCouponsForProductResponseDto })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getAvailableCouponsForProduct(
    @Req() req: any,
    @Param('productId', ParseIntPipe) productId: number
  ): Promise<AvailableCouponsForProductResponseDto> {
    const userId = req.user.id;
    return this.couponService.getAvailableCouponsForProduct(userId, productId);
  }

  /**
   * 쿠폰 유효성 검증
   */
  @Get(':userCouponId/validate')
  @ApiOperation({
    summary: '쿠폰 유효성 검증',
    description: '특정 상품에 대해 쿠폰이 사용 가능한지 검증하고 예상 할인 금액을 반환합니다.'
  })
  @ApiParam({ name: 'userCouponId', description: '사용자 쿠폰 ID' })
  @ApiQuery({ name: 'productId', description: '적용할 상품 ID', type: 'number' })
  @ApiResponse({ status: 200, description: '성공', type: CouponValidationResponseDto })
  async validateCoupon(
    @Req() req: any,
    @Param('userCouponId', ParseIntPipe) userCouponId: number,
    @Query('productId', ParseIntPipe) productId: number
  ): Promise<CouponValidationResponseDto> {
    const userId = req.user.id;
    return this.couponService.validateCoupon(userId, userCouponId, productId);
  }

  /**
   * 쿠폰 상세 정보 조회
   */
  @Get(':userCouponId')
  @ApiOperation({
    summary: '쿠폰 상세 정보 조회',
    description: '특정 쿠폰의 상세 정보를 조회합니다.'
  })
  @ApiParam({ name: 'userCouponId', description: '사용자 쿠폰 ID' })
  @ApiResponse({ status: 200, description: '성공', type: CouponDetailResponseDto })
  @ApiResponse({ status: 404, description: '쿠폰을 찾을 수 없음' })
  async getCouponDetail(
    @Req() req: any,
    @Param('userCouponId', ParseIntPipe) userCouponId: number
  ): Promise<CouponDetailResponseDto> {
    const userId = req.user.id;
    return this.couponService.getCouponDetail(userId, userCouponId);
  }

  /**
   * 쿠폰 사용 (주문 시 호출)
   * 주의: 이 API는 내부적으로 주문 시스템에서 호출되는 용도입니다.
   */
  @Post(':userCouponId/use')
  @ApiOperation({
    summary: '쿠폰 사용',
    description: '주문 시 쿠폰을 사용 처리합니다. 내부 시스템용 API입니다.'
  })
  @ApiParam({ name: 'userCouponId', description: '사용할 쿠폰 ID' })
  @ApiBody({
    description: '주문 정보',
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'number', description: '주문 ID' }
      },
      required: ['orderId']
    }
  })
  @ApiResponse({ status: 200, description: '쿠폰 사용 성공', type: UseCouponResponseDto })
  @ApiResponse({ status: 400, description: '만료된 쿠폰 또는 적용 불가능한 쿠폰' })
  @ApiResponse({ status: 404, description: '쿠폰 또는 주문을 찾을 수 없음' })
  async useCoupon(
    @Req() req: any,
    @Param('userCouponId', ParseIntPipe) userCouponId: number,
    @Body() body: { orderId: number }
  ): Promise<UseCouponResponseDto> {
    const userId = req.user.id;
    return this.couponService.useCoupon(userId, userCouponId, body.orderId);
  }
}