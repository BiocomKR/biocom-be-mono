import { IsString, IsOptional, IsInt, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 앱 이벤트 생성 DTO
 */
export class CreateAppEventDto {
  @ApiProperty({ description: '이벤트 이름', example: 'screen_view' })
  @IsString()
  @MaxLength(100)
  eventName: string;

  @ApiPropertyOptional({ description: '사용자 ID' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiProperty({ description: '플랫폼 (ios/android)', example: 'ios' })
  @IsString()
  @MaxLength(20)
  platform: string;

  @ApiPropertyOptional({ description: '이벤트 파라미터 (JSON)' })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
