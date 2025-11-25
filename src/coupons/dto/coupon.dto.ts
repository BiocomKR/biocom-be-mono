import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Max
} from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  AMOUNT = 'AMOUNT'
}

export enum CouponStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED'
}

/**
 * 사용자 보유 쿠폰 목록 응답 DTO
 */
export class UserCouponListResponseDto {
  @ApiProperty({ description: '쿠폰 목록', type: 'array' })
  coupons: Array<{
    id: number;
    couponId: number;
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    maxDiscountAmount?: number;
    productName: string;
    status: CouponStatus;
    issuedAt: string;
    expiresAt: string;
    remainingHours: number;
  }>;

  @ApiProperty({ description: '총 쿠폰 수', example: 5 })
  totalCount: number;

  @ApiProperty({ description: '사용 가능한 쿠폰 수', example: 3 })
  activeCount: number;
}

/**
 * 특정 상품에 사용 가능한 쿠폰 조회 응답 DTO
 */
export class AvailableCouponsForProductResponseDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  productId: number;

  @ApiProperty({ description: '상품명', example: '바이오밸런스' })
  productName: string;

  @ApiProperty({ description: '사용 가능한 쿠폰 목록', type: 'array' })
  availableCoupons: Array<{
    id: number;
    couponId: number;
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    maxDiscountAmount?: number;
    expectedDiscount: number; // 실제 할인될 금액
    remainingHours: number;
  }>;

  @ApiProperty({ description: '상품 원가', example: 50000 })
  originalPrice: number;

  @ApiProperty({ description: '최대 할인 금액', example: 5000 })
  maxDiscount: number;
}

/**
 * 쿠폰 사용 요청 DTO
 */
export class UseCouponDto {
  @ApiProperty({ description: '사용할 사용자 쿠폰 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  userCouponId: number;
}

/**
 * 쿠폰 사용 응답 DTO
 */
export class UseCouponResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '메시지', example: '쿠폰이 성공적으로 적용되었습니다.' })
  message: string;

  @ApiProperty({ description: '할인된 금액', example: 5000 })
  discountAmount: number;

  @ApiProperty({ description: '쿠폰 정보' })
  usedCoupon: {
    id: number;
    name: string;
    discountType: DiscountType;
    discountValue: number;
    usedAt: string;
  };
}

/**
 * 쿠폰 유효성 검증 응답 DTO
 */
export class CouponValidationResponseDto {
  @ApiProperty({ description: '유효 여부', example: true })
  isValid: boolean;

  @ApiProperty({ description: '검증 메시지', example: '사용 가능한 쿠폰입니다.' })
  message: string;

  @ApiPropertyOptional({ description: '예상 할인 금액', example: 5000 })
  expectedDiscount?: number;

  @ApiPropertyOptional({ description: '만료까지 남은 시간(시간)', example: 36 })
  remainingHours?: number;
}

/**
 * 쿠폰 상세 정보 응답 DTO
 */
export class CouponDetailResponseDto {
  @ApiProperty({ description: '사용자 쿠폰 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '쿠폰 ID', example: 1 })
  couponId: number;

  @ApiProperty({ description: '쿠폰명', example: '바이오밸런스 10% 할인 쿠폰' })
  name: string;

  @ApiPropertyOptional({ description: '쿠폰 설명' })
  description?: string;

  @ApiProperty({ description: '할인 타입', enum: DiscountType, example: DiscountType.PERCENTAGE })
  discountType: DiscountType;

  @ApiProperty({ description: '할인값', example: 10 })
  discountValue: number;

  @ApiPropertyOptional({ description: '최대 할인 금액', example: 5000 })
  maxDiscountAmount?: number;

  @ApiProperty({ description: '적용 상품 정보' })
  product: {
    id: number;
    name: string;
    price?: number;
  };

  @ApiProperty({ description: '쿠폰 상태', enum: CouponStatus, example: CouponStatus.ACTIVE })
  status: CouponStatus;

  @ApiProperty({ description: '발급일시', example: '2025-09-25T10:00:00Z' })
  issuedAt: string;

  @ApiProperty({ description: '만료일시', example: '2025-09-27T10:00:00Z' })
  expiresAt: string;

  @ApiProperty({ description: '만료까지 남은 시간(시간)', example: 36 })
  remainingHours: number;

  @ApiPropertyOptional({ description: '사용일시 (사용된 경우)', example: '2025-09-26T15:30:00Z' })
  usedAt?: string;
}