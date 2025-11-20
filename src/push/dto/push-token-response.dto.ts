import { ApiProperty } from '@nestjs/swagger';

/**
 * 푸시 토큰 응답 DTO
 *
 * 등록된 푸시 토큰 정보 반환
 */
export class PushTokenResponseDto {
  @ApiProperty({
    description: '토큰 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '유저 ID',
    example: 123,
  })
  userId: number;

  @ApiProperty({
    description: '푸시 서비스 제공자',
    example: 'FCM',
  })
  provider: string;

  @ApiProperty({
    description: '디바이스 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  deviceId?: string;

  @ApiProperty({
    description: '플랫폼',
    example: 'android',
    required: false,
  })
  platform?: string;

  @ApiProperty({
    description: '활성화 여부',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '생성일시',
    example: '2025-11-19T15:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2025-11-19T15:30:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: '마지막 사용 일시',
    example: '2025-11-19T16:00:00.000Z',
    required: false,
  })
  lastUsedAt?: Date | null;

  @ApiProperty({
    description: '성공 횟수',
    example: 42,
  })
  successCount: number;

  @ApiProperty({
    description: '실패 횟수',
    example: 2,
  })
  failureCount: number;
}
