import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 주문 목록 조회 쿼리 DTO
 */
export class OrderQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: '검색어 (주문번호, 수령인, 연락처)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '주문 상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 취소/교환/환불 목록 조회 쿼리 DTO
 */
export class ClaimQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: '검색어 (주문번호, 수령인)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '클레임 타입 (CANCEL, EXCHANGE, RETURN)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '처리 상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
