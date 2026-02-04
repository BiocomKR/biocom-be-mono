import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * 인증번호 검증 DTO
 * - KCP 3단계(OTP확인) 처리
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: '인증번호 (본인인증 요청 시 받은 certNumber)',
    example: '25559289599969',
  })
  @IsNotEmpty()
  @IsString()
  certNumber: string;

  @ApiProperty({
    description: 'SMS로 받은 OTP 번호',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP 번호는 6자리 숫자여야 합니다.',
  })
  otpNumber: string;
}
