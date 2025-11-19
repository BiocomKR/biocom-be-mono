import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 테스트 푸시 발송 DTO
 */
export class SendTestPushDto {
  @ApiProperty({
    description: 'FCM 토큰',
    example:
      'fGxV8ZqmTB2...:APA91bF...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: '푸시 알림 제목',
    example: '테스트 푸시',
    default: '백엔드 테스트',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: '푸시 알림 본문',
    example: '푸시 알림 테스트입니다',
    default: 'FCM 푸시 알림 발송 테스트',
  })
  @IsString()
  @IsNotEmpty()
  body: string;
}
