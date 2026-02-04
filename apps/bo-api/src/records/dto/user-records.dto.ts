import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 기록 유형 Enum
 */
export enum RecordType {
  BEAUTY = 'BEAUTY',
  DIET = 'DIET',
  SUPPLEMENT = 'SUPPLEMENT',
  FASTING = 'FASTING',
  SLEEP = 'SLEEP',
  ACTIVITY = 'ACTIVITY',
}

/**
 * 기록 유형 라벨
 */
export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  [RecordType.BEAUTY]: '이너뷰티',
  [RecordType.DIET]: '식단',
  [RecordType.SUPPLEMENT]: '영양제',
  [RecordType.FASTING]: '단식',
  [RecordType.SLEEP]: '수면',
  [RecordType.ACTIVITY]: '활동',
};

/**
 * 회원 기록 조회 쿼리 DTO
 */
export class UserRecordsQueryDto {
  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: '기록 유형', enum: RecordType })
  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

/**
 * 기록 아이템
 */
export class UserRecordItemDto {
  @ApiProperty({ description: '기록 ID' })
  id: number;

  @ApiProperty({ description: '기록 유형' })
  recordType: string;

  @ApiProperty({ description: '기록 유형 라벨' })
  recordTypeLabel: string;

  @ApiProperty({ description: '기록 날짜' })
  date: string;

  @ApiProperty({ description: '메타데이터' })
  metadata: any;

  @ApiProperty({ description: '생성일' })
  createdAt: string;
}

/**
 * 기록 유형별 개수
 */
export class RecordCountByTypeDto {
  @ApiProperty({ description: '이너뷰티' })
  BEAUTY: number;

  @ApiProperty({ description: '식단' })
  DIET: number;

  @ApiProperty({ description: '영양제' })
  SUPPLEMENT: number;

  @ApiProperty({ description: '단식' })
  FASTING: number;

  @ApiProperty({ description: '수면' })
  SLEEP: number;

  @ApiProperty({ description: '활동' })
  ACTIVITY: number;
}

/**
 * 기록 요약
 */
export class UserRecordsSummaryDto {
  @ApiProperty({ description: '전체 기록 수' })
  totalRecords: number;

  @ApiProperty({ description: '기록 유형별 개수', type: RecordCountByTypeDto })
  byType: RecordCountByTypeDto;

  @ApiProperty({ description: '최근 기록 날짜', nullable: true })
  recentDate: string | null;
}

/**
 * 페이지네이션
 */
export class PaginationDto {
  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 개수' })
  limit: number;

  @ApiProperty({ description: '전체 개수' })
  total: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}

/**
 * 회원 기록 조회 응답
 */
export class UserRecordsResponseDto {
  @ApiProperty({ description: '기록 목록', type: [UserRecordItemDto] })
  records: UserRecordItemDto[];

  @ApiProperty({ description: '기록 요약', type: UserRecordsSummaryDto })
  summary: UserRecordsSummaryDto;

  @ApiProperty({ description: '페이지네이션', type: PaginationDto })
  pagination: PaginationDto;
}
