import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 앱 이벤트 생성 DTO
 */
export class CreateAppEventDto {
  @ApiPropertyOptional({
    description: '앱 식별자',
    example: 'innerbeauty_challenge',
    default: 'innerbeauty_challenge',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appId?: string;

  @ApiProperty({ description: '이벤트 이름', example: 'view_item' })
  @IsString()
  @MaxLength(100)
  eventName: string;

  @ApiPropertyOptional({
    description: '이벤트 카테고리',
    example: 'ecommerce',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  eventCategory?: string;

  @ApiPropertyOptional({ description: '사용자 ID' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: '세션 ID', example: 'abc-123-xyz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;

  @ApiProperty({ description: '플랫폼 (ios/android/web)', example: 'ios' })
  @IsString()
  @MaxLength(20)
  platform: string;

  @ApiPropertyOptional({
    description: '아이템 ID (상품, 콘텐츠, 챌린지 등)',
    example: '123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemId?: string;

  @ApiPropertyOptional({
    description: '아이템 타입',
    example: 'product',
    enum: ['product', 'order', 'subscription', 'content', 'lecture', 'challenge', 'quiz'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemType?: string;

  @ApiPropertyOptional({ description: '금액 (이커머스용)', example: 50000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ description: '수량', example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: '이벤트 파라미터 (JSON)' })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
