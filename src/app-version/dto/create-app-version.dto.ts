import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppVersionDto {
  @ApiProperty({
    description: '플랫폼',
    example: 'IOS',
    enum: ['IOS', 'ANDROID', 'WEB'],
  })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({
    description: '버전 (semver)',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiPropertyOptional({
    description: '빌드 번호 (모바일용)',
    example: 100,
  })
  @IsInt()
  @IsOptional()
  buildNumber?: number;

  @ApiProperty({
    description: '최소 지원 버전',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  minRequiredVersion: string;

  @ApiPropertyOptional({
    description: '강제 업데이트 여부',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isForceUpdate?: boolean;

  @ApiPropertyOptional({
    description: '점검 모드 여부',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isMaintenanceMode?: boolean;

  @ApiPropertyOptional({
    description: '점검 안내 메시지',
    example: '서버 점검 중입니다. 잠시 후 다시 시도해주세요.',
  })
  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @ApiPropertyOptional({
    description: '릴리즈 노트',
    example: '- 버그 수정\n- 성능 개선',
  })
  @IsString()
  @IsOptional()
  releaseNotes?: string;

  @ApiPropertyOptional({
    description: '스토어 URL',
    example: 'https://apps.apple.com/app/id123456789',
  })
  @IsString()
  @IsOptional()
  storeUrl?: string;

  @ApiPropertyOptional({
    description: '활성화 여부',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '배포일',
    example: '2025-12-05T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  releasedAt?: string;
}
