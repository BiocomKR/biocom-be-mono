import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsNotEmpty, Min } from 'class-validator';

/**
 * 구독 생성 요청 DTO
 *
 * 사용자가 구독 상품 구매 시 사용
 */
export class CreateSubscriptionDto {
  /**
   * 구독 상품 ID
   * @example 10
   */
  @ApiProperty({
    description: '구독 상품 ID',
    example: 10,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  productId: number;

  /**
   * 결제 주기 (일 단위)
   * 30 = 월구독, 90 = 3개월, 365 = 연구독
   * @example 30
   */
  @ApiProperty({
    description: '결제 주기 (일 단위)',
    example: 30,
    default: 30,
  })
  @IsInt()
  @Min(1)
  billingCycle?: number = 30;
}
