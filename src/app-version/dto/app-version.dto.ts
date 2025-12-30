/**
 * 앱 버전 DTO
 */

import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppBundleId } from '../../common/enums';

export enum Platform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

export class CreateAppVersionDto {
  @ApiProperty({ description: '플랫폼', enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiPropertyOptional({ description: '앱 번들 ID', enum: AppBundleId })
  @IsOptional()
  @IsString()
  bundleId?: string;

  @ApiProperty({ description: '버전 (예: 1.0.0)' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ description: '빌드 번호' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  buildNumber?: number;

  @ApiPropertyOptional({ description: '강제 업데이트 여부' })
  @IsOptional()
  @IsBoolean()
  isForceUpdate?: boolean;

  @ApiPropertyOptional({ description: '점검 모드 여부' })
  @IsOptional()
  @IsBoolean()
  isMaintenanceMode?: boolean;

  @ApiPropertyOptional({ description: '점검 안내 메시지' })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiPropertyOptional({ description: '릴리즈 노트' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @ApiPropertyOptional({ description: '스토어 URL' })
  @IsOptional()
  @IsString()
  storeUrl?: string;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '배포일' })
  @IsOptional()
  @IsString()
  releasedAt?: string;
}

export class UpdateAppVersionDto {
  @ApiPropertyOptional({ description: '플랫폼', enum: Platform })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ description: '앱 번들 ID', enum: AppBundleId })
  @IsOptional()
  @IsString()
  bundleId?: string;

  @ApiPropertyOptional({ description: '버전' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: '빌드 번호' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  buildNumber?: number;

  @ApiPropertyOptional({ description: '강제 업데이트 여부' })
  @IsOptional()
  @IsBoolean()
  isForceUpdate?: boolean;

  @ApiPropertyOptional({ description: '점검 모드 여부' })
  @IsOptional()
  @IsBoolean()
  isMaintenanceMode?: boolean;

  @ApiPropertyOptional({ description: '점검 안내 메시지' })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiPropertyOptional({ description: '릴리즈 노트' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @ApiPropertyOptional({ description: '스토어 URL' })
  @IsOptional()
  @IsString()
  storeUrl?: string;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '배포일' })
  @IsOptional()
  @IsString()
  releasedAt?: string;
}

export class AppVersionQueryDto {
  @ApiPropertyOptional({ description: '플랫폼 필터', enum: Platform })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ description: '번들 ID 필터', enum: AppBundleId })
  @IsOptional()
  @IsString()
  bundleId?: string;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}
