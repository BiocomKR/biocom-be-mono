import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PushCampaignType, PushCampaignStatus } from '../enums';

/**
 * 캠페인 조회 쿼리 DTO
 */
export class CampaignQueryDto {
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

  @ApiPropertyOptional({ description: '스케줄 ID 필터', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleId?: number;

  @ApiPropertyOptional({
    description: '캠페인 타입 필터',
    enum: PushCampaignType
  })
  @IsOptional()
  @IsEnum(PushCampaignType)
  campaignType?: PushCampaignType;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: PushCampaignStatus
  })
  @IsOptional()
  @IsEnum(PushCampaignStatus)
  status?: PushCampaignStatus;

  @ApiPropertyOptional({ description: '시작 날짜 (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료 날짜 (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
