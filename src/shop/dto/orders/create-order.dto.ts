import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsArray, 
  IsInt, 
  IsString, 
  IsOptional, 
  ValidateNested,
  IsPositive,
  MaxLength,
  Matches,
  Min
} from 'class-validator';

/**
 * 배송 주소 DTO
 */
export class ShippingAddressDto {
  @ApiProperty({ description: '수령인명' })
  @IsString()
  @MaxLength(100)
  recipientName: string;

  @ApiProperty({ description: '수령인 전화번호' })
  @IsString()
  @Matches(/^[0-9-]+$/, { message: '올바른 전화번호 형식이 아닙니다' })
  recipientPhone: string;

  @ApiProperty({ description: '우편번호' })
  @IsString()
  @Matches(/^[0-9]{5}$/, { message: '우편번호는 5자리 숫자여야 합니다' })
  postalCode: string;

  @ApiProperty({ description: '주소' })
  @IsString()
  @MaxLength(255)
  address: string;

  @ApiPropertyOptional({ description: '상세주소' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressDetail?: string;

  @ApiPropertyOptional({ description: '배송 메시지' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryMessage?: string;
}

/**
 * 주문 생성 요청 DTO
 */
export class CreateOrderDto {
  @ApiProperty({ 
    description: '장바구니 아이템 ID 목록',
    example: [1, 2, 3]
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  cartItemIds: number[];

  @ApiProperty({ 
    description: '배송 주소 정보',
    type: ShippingAddressDto
  })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({ 
    description: '사용할 포인트',
    default: 0,
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  pointUsed?: number;
}

/**
 * 주문 아이템 응답 DTO
 */
export class OrderItemResponseDto {
  @ApiProperty({ description: '주문 아이템 ID' })
  id: number;

  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '상품 ID' })
  productId: number;

  @ApiProperty({ description: '상품 옵션 ID' })
  productOptionId: number;

  @ApiProperty({ description: '상품명 (주문 시점)' })
  productName: string;

  @ApiProperty({ description: '옵션명 (주문 시점)', nullable: true })
  optionName: string | null;

  @ApiProperty({ description: '상품 단가' })
  productPrice: number;

  @ApiProperty({ description: '수량' })
  quantity: number;

  @ApiProperty({ description: '소계' })
  subtotal: number;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;
}

/**
 * 주문 응답 DTO
 */
export class OrderResponseDto {
  @ApiProperty({ description: '주문 ID' })
  id: number;

  @ApiProperty({ description: '주문번호' })
  orderNumber: string;

  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '재고 처리 상태' })
  inventoryStatus: string;

  @ApiProperty({ description: '상품 총액' })
  totalProductPrice: number;

  @ApiProperty({ description: '할인 총액' })
  totalDiscount: number;

  @ApiProperty({ description: '배송비' })
  shippingFee: number;

  @ApiProperty({ description: '사용 포인트' })
  pointUsed: number;

  @ApiProperty({ description: '최종 결제액' })
  totalAmount: number;

  @ApiProperty({ description: '수령인명' })
  recipientName: string;

  @ApiProperty({ description: '수령인 전화번호' })
  recipientPhone: string;

  @ApiProperty({ description: '우편번호' })
  postalCode: string;

  @ApiProperty({ description: '주소' })
  address: string;

  @ApiProperty({ description: '상세주소', nullable: true })
  addressDetail: string | null;

  @ApiProperty({ description: '배송 메시지', nullable: true })
  deliveryMessage: string | null;

  @ApiProperty({ description: '주문일시' })
  orderedAt: Date;

  @ApiProperty({ description: '결제일시', nullable: true })
  paidAt: Date | null;

  @ApiProperty({ description: '발송일시', nullable: true })
  shippedAt: Date | null;

  @ApiProperty({ description: '배송완료일시', nullable: true })
  deliveredAt: Date | null;

  @ApiProperty({ description: '구매확정일시', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ description: '취소일시', nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ description: '주문 아이템', type: [OrderItemResponseDto], required: false })
  items?: OrderItemResponseDto[];

  @ApiProperty({ description: '결제 정보', required: false })
  payment?: any;

  @ApiProperty({ description: '배송 정보', required: false })
  shipping?: any;
}