import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, Min, Max } from 'class-validator';

/**
 * 장바구니 추가 요청 DTO
 */
export class AddCartItemDto {
  @ApiProperty({ description: '상품 ID' })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ description: '수량', minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

/**
 * 장바구니 수량 변경 요청 DTO
 */
export class UpdateCartItemDto {
  @ApiProperty({ description: '변경할 수량', minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

/**
 * 장바구니 아이템 응답 DTO
 */
export class CartItemResponseDto {
  @ApiProperty({ description: '장바구니 아이템 ID' })
  id: number;

  @ApiProperty({ description: '장바구니 ID' })
  cartId: number;

  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '수량' })
  quantity: number;

  @ApiProperty({ description: '재고 확인 시각', nullable: true })
  stockCheckedAt: Date | null;

  @ApiProperty({ description: '재고 가용 여부' })
  stockAvailable: boolean;

  @ApiProperty({ description: '추가일시' })
  addedAt: Date;

  @ApiProperty({ description: '수정일시', nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ description: '상품 정보', required: false })
  product?: any;

  @ApiProperty({ description: '소계 금액', required: false })
  subtotal?: number;
}

/**
 * 장바구니 응답 DTO
 */
export class CartResponseDto {
  @ApiProperty({ description: '장바구니 ID' })
  id: number;

  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정일시', nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ description: '장바구니 아이템', type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ description: '총 상품 금액', required: false })
  totalProductPrice?: number;

  @ApiProperty({ description: '총 수량', required: false })
  totalQuantity?: number;
}

/**
 * 장바구니 검증 응답 DTO
 */
export class CartValidationResponseDto {
  @ApiProperty({ description: '유효성 검사 통과 여부' })
  valid: boolean;

  @ApiProperty({ description: '재고 부족 아이템', type: [CartItemResponseDto], required: false })
  invalidItems?: CartItemResponseDto[];

  @ApiProperty({ description: '검증 메시지', required: false })
  message?: string;
}