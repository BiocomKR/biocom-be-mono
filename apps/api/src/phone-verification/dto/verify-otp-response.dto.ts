import { ApiProperty } from '@nestjs/swagger';

/**
 * 인증번호 검증 응답 DTO
 * - KCP 3단계 완료 후 CI/DI 반환
 */
export class VerifyOtpResponseDto {
  @ApiProperty({
    description: '본인인증 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'CI (연계정보)',
    example: 'CI1234567890ABCDEF',
  })
  ci: string;

  @ApiProperty({
    description: 'DI (중복가입확인정보)',
    example: 'DI1234567890ABCDEF',
  })
  di: string;

  @ApiProperty({
    description: '응답 메시지',
    example: '본인인증이 완료되었습니다.',
  })
  message: string;
}
