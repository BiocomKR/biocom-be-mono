import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 반품 신청 DTO
 */
export class CreateReturnDto {
  @ApiProperty({
    description: '반품 사유',
    example: '상품 불량'
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: '상세 사유',
    example: '포장이 훼손되어 있습니다',
    required: false
  })
  @IsString()
  @IsOptional()
  reasonDetail?: string;
}

/**
 * 교환 신청 DTO
 */
export class CreateExchangeDto {
  @ApiProperty({
    description: '교환 사유',
    example: '사이즈 변경'
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    description: '상세 사유',
    example: 'M → L',
    required: false
  })
  @IsString()
  @IsOptional()
  reasonDetail?: string;
}

/**
 * 반품/교환 응답 DTO
 */
export class ReturnExchangeResponseDto {
  @ApiProperty({ description: '반품/교환 ID' })
  id: number;

  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문번호' })
  orderNumber: string;

  @ApiProperty({ description: '타입', enum: ['RETURN', 'EXCHANGE'] })
  type: string;

  @ApiProperty({ description: '상태', enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'] })
  status: string;

  @ApiProperty({ description: '사유' })
  reason: string;

  @ApiProperty({ description: '상세 사유', nullable: true })
  reasonDetail: string | null;

  @ApiProperty({ description: '신청일시' })
  requestedAt: Date;

  @ApiProperty({ description: '승인일시', nullable: true })
  approvedAt: Date | null;

  @ApiProperty({ description: '완료일시', nullable: true })
  completedAt: Date | null;
}
