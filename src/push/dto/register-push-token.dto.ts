import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 푸시 토큰 등록 DTO
 *
 * 유저의 디바이스 FCM 토큰을 등록하기 위한 요청 데이터
 */
export class RegisterPushTokenDto {
  /**
   * FCM 토큰
   *
   * Firebase에서 발급받은 디바이스 고유 토큰
   */
  @ApiProperty({
    description: 'FCM 토큰',
    example:
      'dKLHTmqWRl-BGhqwNxKZkY:APA91bGW8L5zPJC0Ut6T4v2HlQu9f_v7Qs9YxP5N1cXvpN7r8dW1MqZsY4xT3vR2pL1wQvKm8N5sY6xT7vB3mP9qRsL4wN1xY5zT8vC2pM7qRsK6wN9yT0vE4mP8qSsN2wT5yR3v',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  /**
   * 디바이스 ID (선택)
   *
   * 디바이스 고유 식별자 (UUID 등)
   * 미제공 시 토큰으로 구분
   */
  @ApiProperty({
    description: '디바이스 ID (선택)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;

  /**
   * 플랫폼 (선택)
   *
   * ios, android, web 등
   */
  @ApiProperty({
    description: '플랫폼',
    example: 'android',
    enum: ['ios', 'android', 'web'],
    required: false,
  })
  @IsEnum(['ios', 'android', 'web'])
  @IsOptional()
  platform?: string;
}
