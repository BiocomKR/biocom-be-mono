import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray,
  ValidateNested,
  Min,
  MaxLength
} from 'class-validator';

/**
 * 환불 아이템 DTO
 */
export class RefundItemDto {
  @ApiProperty({ description: '주문 아이템 ID' })
  @IsNumber()
  orderItemId: number;

  @ApiProperty({ description: '환불 수량' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: '환불 사유' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * 계좌 정보 DTO
 */
export class BankAccountDto {
  @ApiProperty({ description: '은행명' })
  @IsString()
  bankName: string;

  @ApiProperty({ description: '계좌번호' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ description: '예금주명' })
  @IsString()
  accountHolder: string;
}

/**
 * 환불 요청 생성 DTO
 */
export class CreateRefundDto {
  @ApiProperty({ description: '주문번호' })
  @IsString()
  orderNumber: string;

  @ApiProperty({ description: '환불 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ 
    description: '부분 환불 아이템 (미입력 시 전체 환불)',
    type: [RefundItemDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  refundItems?: RefundItemDto[];

  @ApiPropertyOptional({ 
    description: '계좌이체 환불 정보 (가상계좌 결제 시)',
    type: BankAccountDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankTransfer?: BankAccountDto;
}

/**
 * 환불 상태 업데이트 DTO
 */
export class UpdateRefundDto {
  @ApiPropertyOptional({ description: '환불 상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '거절 사유' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: '거래 ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;
}

/**
 * 환불 아이템 응답 DTO
 */
export class RefundItemResponseDto {
  @ApiProperty({ description: '환불 아이템 ID' })
  id: number;

  @ApiProperty({ description: '주문 아이템 ID' })
  orderItemId: number;

  @ApiProperty({ description: '환불 수량' })
  quantity: number;

  @ApiProperty({ description: '환불 금액' })
  amount: number;

  @ApiProperty({ description: '환불 사유' })
  reason: string;
}

/**
 * 환불 응답 DTO
 */
export class RefundResponseDto {
  @ApiProperty({ description: '환불 ID' })
  id: number;

  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문번호' })
  orderNumber: string;

  @ApiProperty({ description: '결제 ID' })
  paymentId: number;

  @ApiProperty({ description: '환불 금액' })
  amount: number;

  @ApiProperty({ description: '환불 사유' })
  reason: string;

  @ApiProperty({ description: '환불 상태' })
  status: string;

  @ApiProperty({ description: '환불 방법' })
  method: string;

  @ApiProperty({ description: '은행명', nullable: true })
  bankName: string | null;

  @ApiProperty({ description: '계좌번호', nullable: true })
  accountNumber: string | null;

  @ApiProperty({ description: '예금주명', nullable: true })
  accountHolder: string | null;

  @ApiProperty({ description: '요청일시' })
  requestedAt: Date;

  @ApiProperty({ description: '승인일시', nullable: true })
  approvedAt: Date | null;

  @ApiProperty({ description: '거절일시', nullable: true })
  rejectedAt: Date | null;

  @ApiProperty({ description: '완료일시', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ description: '거절 사유', nullable: true })
  rejectionReason: string | null;

  @ApiProperty({ description: '거래 ID', nullable: true })
  transactionId: string | null;

  @ApiProperty({ description: '실패 사유', nullable: true })
  failReason: string | null;

  @ApiPropertyOptional({ 
    description: '환불 아이템 목록',
    type: [RefundItemResponseDto]
  })
  refundItems?: RefundItemResponseDto[];
}

/**
 * 환불 목록 응답 DTO
 */
export class RefundListResponseDto {
  @ApiProperty({ description: '환불 목록', type: [RefundResponseDto] })
  items: RefundResponseDto[];

  @ApiProperty({ description: '전체 개수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 개수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}