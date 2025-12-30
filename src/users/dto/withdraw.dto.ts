import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 회원탈퇴 요청 DTO
 */
export class WithdrawDto {
  @ApiPropertyOptional({
    description: '탈퇴 사유 (선택)',
    example: '서비스를 더 이상 이용하지 않음',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * 회원탈퇴 응답 DTO
 */
export class WithdrawResponseDto {
  @ApiProperty({
    description: '탈퇴 처리 결과',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '메시지',
    example: '회원탈퇴가 완료되었습니다.',
  })
  message: string;
}
