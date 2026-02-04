import { ApiProperty } from '@nestjs/swagger';

/**
 * 본인인증 요청 응답 DTO
 * - KCP 1단계 + 2단계 완료 후 반환
 */
export class RequestVerificationResponseDto {
  @ApiProperty({
    description: '인증번호 (3단계 검증 시 필요)',
    example: '25559289599969',
  })
  certNumber: string;

  @ApiProperty({
    description: '응답 메시지',
    example: 'SMS가 발송되었습니다. 인증번호를 확인해주세요.',
  })
  message: string;
}
