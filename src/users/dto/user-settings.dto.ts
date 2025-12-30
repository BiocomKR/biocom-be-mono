import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * 사용자 설정 응답 DTO
 */
export class UserSettingsResponseDto {
  @ApiProperty({
    description: '푸시 알림 수신 동의 여부 (null: 미설정, true: 동의, false: 거부)',
    example: true,
    nullable: true,
  })
  pushEnabled: boolean | null;
}

/**
 * 사용자 설정 업데이트 DTO
 */
export class UpdateUserSettingsDto {
  @ApiProperty({
    description: '푸시 알림 수신 동의 여부',
    example: true,
  })
  @IsBoolean()
  pushEnabled: boolean;
}
