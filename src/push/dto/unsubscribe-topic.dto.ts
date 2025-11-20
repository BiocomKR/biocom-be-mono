import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray } from 'class-validator';

/**
 * FCM Topic 구독 해제 DTO
 */
export class UnsubscribeTopicDto {
  /**
   * 구독 해제할 토픽 이름
   */
  @ApiProperty({
    description: '구독 해제할 토픽 이름',
    example: 'marketing',
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  /**
   * 구독 해제할 FCM 토큰 배열 (선택적, 없으면 현재 유저의 모든 토큰)
   */
  @ApiProperty({
    description: 'FCM 토큰 배열 (선택적)',
    example: ['token1', 'token2'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  tokens?: string[];
}
