import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

/**
 * 주문 상태 변경 DTO
 */
export class UpdateOrderStatusDto {
  @ApiProperty({ description: '변경할 상태' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '변경 사유' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * 송장 입력 DTO
 */
export class UpdateTrackingDto {
  @ApiProperty({ description: '택배사 코드' })
  @IsString()
  courierCode: string;

  @ApiProperty({ description: '택배사명' })
  @IsString()
  courierName: string;

  @ApiProperty({ description: '송장번호' })
  @IsString()
  trackingNumber: string;
}

/**
 * 취소/환불 처리 DTO
 */
export class ProcessRefundDto {
  @ApiProperty({ description: '처리 상태 (APPROVED, REJECTED)' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '관리자 메모' })
  @IsOptional()
  @IsString()
  adminMemo?: string;

  @ApiPropertyOptional({ description: '환불 금액 (부분 환불 시)' })
  @IsOptional()
  @IsNumber()
  refundAmount?: number;
}

/**
 * 교환/반품 처리 DTO
 */
export class ProcessExchangeReturnDto {
  @ApiProperty({ description: '처리 상태 (APPROVED, REJECTED, COMPLETED)' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: '관리자 메모' })
  @IsOptional()
  @IsString()
  adminMemo?: string;

  @ApiPropertyOptional({ description: '송장번호 (반품 회수용)' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: '택배사 코드' })
  @IsOptional()
  @IsString()
  courierCode?: string;

  @ApiPropertyOptional({ description: '택배사명' })
  @IsOptional()
  @IsString()
  courierName?: string;
}
