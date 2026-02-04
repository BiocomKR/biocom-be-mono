import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

/**
 * 푸시 알림 전송 DTO
 */
export class SendPushDto {
  @ApiProperty({
    description: '푸시 알림 제목',
    example: '새로운 챌린지가 시작되었습니다!',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '푸시 알림 본문',
    example: '7일 물 마시기 챌린지에 참여해보세요',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({
    description: '푸시 알림 이미지 URL',
    example: 'https://example.com/image.png',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: '추가 데이터 (JSON 객체)',
    example: { challengeId: '123', type: 'challenge' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({
    description: '테스트 발송 여부 (기본값: false)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  @ApiPropertyOptional({
    description:
      'Silent Push 여부 (기본값: false)\n' +
      'true: 알림 표시 없이 data만 전송 (백그라운드 처리용)\n' +
      'false: 일반 푸시 알림으로 전송',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  silent?: boolean;
}
