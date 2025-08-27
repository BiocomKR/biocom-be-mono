import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

/**
 * 배송 정보 업데이트 DTO
 */
export class UpdateShippingDto {
  @ApiProperty({ description: '택배사', example: 'CJ대한통운' })
  @IsString()
  @MaxLength(50)
  carrier: string;

  @ApiProperty({ description: '운송장 번호' })
  @IsString()
  @MaxLength(50)
  trackingNumber: string;

  @ApiPropertyOptional({ description: '배송 예정일' })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: Date;
}

/**
 * 배송 정보 응답 DTO
 */
export class ShippingResponseDto {
  @ApiProperty({ description: '배송 ID' })
  id: number;

  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문번호' })
  orderNumber: string;

  @ApiProperty({ description: '배송 상태' })
  status: string;

  @ApiProperty({ description: '택배사', nullable: true })
  carrier: string | null;

  @ApiProperty({ description: '운송장 번호', nullable: true })
  trackingNumber: string | null;

  @ApiProperty({ description: '배송비' })
  shippingFee: number;

  @ApiProperty({ description: '배송 예정일', nullable: true })
  estimatedDeliveryDate: Date | null;

  @ApiProperty({ description: '실제 배송일', nullable: true })
  actualDeliveryDate: Date | null;

  @ApiProperty({ description: '발송일시', nullable: true })
  shippedAt: Date | null;

  @ApiProperty({ description: '배송완료일시', nullable: true })
  deliveredAt: Date | null;

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
}

/**
 * 배송 추적 이벤트 DTO
 */
export class TrackingEventDto {
  @ApiProperty({ description: '이벤트 시간' })
  timestamp: Date;

  @ApiProperty({ description: '상태' })
  status: string;

  @ApiProperty({ description: '위치' })
  location: string;

  @ApiProperty({ description: '설명' })
  description: string;
}

/**
 * 배송 추적 응답 DTO
 */
export class TrackingResponseDto {
  @ApiProperty({ description: '택배사' })
  carrier: string;

  @ApiProperty({ description: '운송장 번호' })
  trackingNumber: string;

  @ApiProperty({ description: '현재 배송 상태' })
  status: string;

  @ApiProperty({ description: '배송 예정일', nullable: true })
  estimatedDeliveryDate: Date | null;

  @ApiProperty({ description: '실제 배송일', nullable: true })
  actualDeliveryDate: Date | null;

  @ApiProperty({ description: '수령인명' })
  recipientName: string;

  @ApiProperty({ description: '발송인명' })
  senderName: string;

  @ApiProperty({ 
    description: '배송 추적 이벤트', 
    type: [TrackingEventDto] 
  })
  events: TrackingEventDto[];
}