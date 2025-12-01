import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum IAPPlatformType {
  APPLE = 'APPLE',
  GOOGLE = 'GOOGLE',
}

/**
 * 영수증 검증 요청 DTO
 * 앱에서 구매 완료 후 서버에 영수증 검증 요청 시 사용
 */
export class VerifyReceiptDto {
  @ApiProperty({
    description: '플랫폼 (APPLE 또는 GOOGLE)',
    enum: IAPPlatformType,
    example: 'APPLE',
  })
  @IsEnum(IAPPlatformType)
  @IsNotEmpty()
  platform: IAPPlatformType;

  @ApiProperty({
    description: '영수증 데이터 (Apple: receipt-data base64, Google: purchaseToken)',
    example: 'MIITuQYJKoZIhvc...',
  })
  @IsString()
  @IsNotEmpty()
  receiptData: string;

  @ApiProperty({
    description: '상품 ID (Apple: productId, Google: productId)',
    example: 'com.BiocomChallenge.consumable.challenge_1',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: '트랜잭션 ID (Apple: transactionId, Google: orderId)',
    example: '1000000123456789',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}

/**
 * 영수증 검증 응답 DTO
 */
export class VerifyReceiptResponseDto {
  @ApiProperty({ description: '검증 성공 여부' })
  success: boolean;

  @ApiProperty({ description: '발급된 챌린지 티켓 ID', required: false })
  ticketId?: number;

  @ApiProperty({ description: '메시지' })
  message: string;
}
