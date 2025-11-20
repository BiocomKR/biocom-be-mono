import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsBoolean, IsString, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
    enum: ['ONCE', 'RECURRING']
  })
  @IsOptional()
  @IsString()
  @IsIn(['ONCE', 'RECURRING'])
  scheduleType?: string;

  @ApiPropertyOptional({
    description: '카테고리 필터',
    enum: ['AUTO', 'MARKETING']
  })
  @IsOptional()
  @IsString()
  @IsIn(['AUTO', 'MARKETING'])
  category?: string;

  @ApiPropertyOptional({ description: '활성화 여부 필터', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}