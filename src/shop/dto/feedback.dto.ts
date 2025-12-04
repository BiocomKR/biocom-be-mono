/**
 * 상품 리뷰/문의 관리 DTO
 */

import { IsOptional, IsString, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ===== Enum =====

export enum FeedbackType {
  REVIEW = 'REVIEW',
  QUESTION = 'QUESTION',
}

export enum FeedbackStatus {
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export enum ReviewType {
  TEXT = 'TEXT',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
}

export enum QuestionType {
  PRODUCT = 'PRODUCT',
  DELIVERY = 'DELIVERY',
  STOCK = 'STOCK',
  SIZE = 'SIZE',
  OTHER = 'OTHER',
}

export enum FeedbackSortBy {
  CREATED_AT = 'createdAt',
  RATING = 'rating',
  HELPFUL_COUNT = 'helpfulCount',
}

// ===== 리뷰 목록 조회 =====

export class ReviewListQueryDto {
  @ApiPropertyOptional({ description: '검색어 (상품명, 작성자명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태', enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiPropertyOptional({ description: '평점 (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: '리뷰 타입', enum: ReviewType })
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiPropertyOptional({ description: '베스트 여부' })
  @IsOptional()
  isBest?: string;

  @ApiPropertyOptional({ description: '정렬 기준', enum: FeedbackSortBy })
  @IsOptional()
  @IsEnum(FeedbackSortBy)
  sortBy?: FeedbackSortBy;

  @ApiPropertyOptional({ description: '정렬 순서', enum: ['asc', 'desc'] })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ===== 문의 목록 조회 =====

export class QuestionListQueryDto {
  @ApiPropertyOptional({ description: '검색어 (상품명, 작성자명, 제목)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태', enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiPropertyOptional({ description: '문의 유형', enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({ description: '답변 상태 (true: 완료, false: 대기)' })
  @IsOptional()
  hasAnswer?: string;

  @ApiPropertyOptional({ description: '정렬 기준', enum: FeedbackSortBy })
  @IsOptional()
  @IsEnum(FeedbackSortBy)
  sortBy?: FeedbackSortBy;

  @ApiPropertyOptional({ description: '정렬 순서', enum: ['asc', 'desc'] })
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ===== 리뷰 숨김 처리 =====

export class HideReviewDto {
  @ApiProperty({ description: '숨김 사유' })
  @IsString()
  hiddenReason: string;
}

// ===== 문의 답변 작성 =====

export class AnswerQuestionDto {
  @ApiProperty({ description: '답변 내용' })
  @IsString()
  content: string;
}
