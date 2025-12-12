import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 환불계좌 수정 DTO
 */
export class UpdateRefundAccountDto {
  @ApiProperty({ description: '은행 코드 (예: 004)', maxLength: 10 })
  @IsString()
  @MaxLength(10)
  refundBankCode: string;

  @ApiProperty({ description: '은행명 (예: KB국민은행)', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  refundBankName: string;

  @ApiProperty({ description: '계좌번호 (숫자만)', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @Matches(/^\d+$/, { message: '계좌번호는 숫자만 포함해야 합니다' })
  refundAccountNo: string;

  @ApiProperty({ description: '예금주명', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  refundHolder: string;
}

/**
 * 환불계좌 응답 DTO
 */
export class RefundAccountResponseDto {
  @ApiPropertyOptional({ description: '은행 코드' })
  refundBankCode: string | null;

  @ApiPropertyOptional({ description: '은행명' })
  refundBankName: string | null;

  @ApiPropertyOptional({ description: '계좌번호' })
  refundAccountNo: string | null;

  @ApiPropertyOptional({ description: '예금주명' })
  refundHolder: string | null;
}
