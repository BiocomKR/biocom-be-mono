import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 빌링키 등록 요청 DTO
 *
 * 토스페이먼츠 빌링키 발급 후 백엔드에 등록
 */
export class RegisterBillingDto {
  /**
   * 토스페이먼츠 빌링키 (자동결제 키)
   * @example "BIL_abc123def456"
   */
  @ApiProperty({
    description: '토스페이먼츠 빌링키',
    example: 'BIL_abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  billingKey: string;

  /**
   * 토스페이먼츠 고객키 (사용자 식별자)
   * @example "user_12345"
   */
  @ApiProperty({
    description: '토스페이먼츠 고객키',
    example: 'user_12345',
  })
  @IsString()
  @IsNotEmpty()
  customerKey: string;
}
