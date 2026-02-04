import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * 토픽 푸시 전송 DTO
 */
export class SendPushToTopicDto {
  /**
   * 토픽 이름
   */
  @ApiProperty({
    description: '전송할 토픽 이름',
    example: 'marketing',
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  /**
   * 푸시 제목
   */
  @ApiProperty({
    description: '푸시 제목',
    example: '새로운 이벤트가 시작되었습니다!',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * 푸시 본문
   */
  @ApiProperty({
    description: '푸시 본문',
    example: '지금 바로 참여하고 혜택을 받아보세요',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  /**
   * 이미지 URL (선택)
   */
  @ApiPropertyOptional({
    description: '푸시 이미지 URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  /**
   * 추가 데이터 (선택)
   */
  @ApiPropertyOptional({
    description: '추가 데이터 (딥링크, 액션 등)',
    example: { type: 'EVENT', eventId: '123' },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  /**
   * 대상 앱 bundleId (선택)
   * dev 앱(.dev 포함)과 prod 앱 구분용
   */
  @ApiPropertyOptional({
    description: '대상 앱 bundleId (kr.biocom.challenge.dev 또는 kr.biocom.challenge)',
    example: 'kr.biocom.challenge',
  })
  @IsString()
  @IsOptional()
  bundleId?: string;
}
