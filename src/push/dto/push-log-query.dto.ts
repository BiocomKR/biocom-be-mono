import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 푸시 로그 조회 쿼리 DTO
 */
export class PushLogQueryDto {
  /**
   * 페이지 번호 (1부터 시작)
   */
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * 페이지당 항목 수
   */
  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  /**
   * 특정 유저의 로그만 조회
   */
  @ApiPropertyOptional({ description: '특정 유저 ID', type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  /**
   * 성공 여부 필터
   */
  @ApiPropertyOptional({ description: '성공 여부 필터', type: Boolean })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  success?: boolean;

  /**
   * 푸시 타입 필터
   */
  @ApiPropertyOptional({ description: '푸시 타입 필터 (예: SYSTEM, REMIND, MARKETING, TRANSACTIONAL, ETC)', type: String })
  @IsOptional()
  @IsString()
  type?: string;
}
