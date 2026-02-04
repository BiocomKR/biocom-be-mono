import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsBoolean, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PushScheduleType, PushCategory } from '../enums';
import { AppBundleId } from '../../common/enums';

/**
 * 스케줄 조회 쿼리 DTO
 */
export class ScheduleQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '스케줄 타입 필터',
    enum: PushScheduleType
  })
  @IsOptional()
  @IsEnum(PushScheduleType)
  scheduleType?: PushScheduleType;

  @ApiPropertyOptional({
    description: '카테고리 필터',
    enum: PushCategory
  })
  @IsOptional()
  @IsEnum(PushCategory)
  category?: PushCategory;

  @ApiPropertyOptional({ description: '활성화 여부 필터', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '앱 번들ID 필터',
    enum: AppBundleId,
  })
  @IsOptional()
  @IsEnum(AppBundleId)
  bundleId?: AppBundleId;
}