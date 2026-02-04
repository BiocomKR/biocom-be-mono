import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckVersionDto {
  @ApiProperty({
    description: '플랫폼',
    example: 'IOS',
    enum: ['IOS', 'ANDROID', 'WEB'],
  })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({
    description: '현재 앱 버전',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiPropertyOptional({
    description: '앱 번들 ID (패키지명)',
    example: 'kr.biocom.challenge',
  })
  @IsString()
  @IsOptional()
  bundleId?: string;
}
