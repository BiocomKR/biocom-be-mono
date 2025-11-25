import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 빌링키 등록 요청 DTO
 *
 * 앱에서 토스 결제창으로부터 받은 authKey를 전달하면
 * 백엔드가 토스 API를 호출하여 billingKey를 발급받음
 */
export class RegisterBillingDto {
  /**
   * 토스페이먼츠 인증키 (토스 결제창에서 발급)
   * @example "auth_abc123def456"
   */
  @ApiProperty({
    description: '토스페이먼츠 인증키 (토스 결제창에서 발급)',
    example: 'auth_abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  authKey: string;

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
