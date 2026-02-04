import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Q&A 문의 타입
 */
export enum QuestionType {
  PRODUCT = 'PRODUCT',   // 상품 문의
  DELIVERY = 'DELIVERY', // 배송 문의
  STOCK = 'STOCK',       // 재고 문의
  SIZE = 'SIZE',         // 사이즈 문의
  OTHER = 'OTHER'        // 기타 문의
}

/**
 * Q&A 정렬 타입
 */
export enum QnaSortType {
  LATEST = 'latest',           // 최신순
  OLDEST = 'oldest',           // 오래된순
  ANSWERED = 'answered',       // 답변완료순
  UNANSWERED = 'unanswered'    // 미답변순
}

/**
 * Q&A 필터 타입
 */
export enum QnaFilterType {
  ALL = 'all',                 // 전체
  ANSWERED = 'answered',       // 답변완료
  UNANSWERED = 'unanswered'    // 미답변
}

/**
 * Q&A 작성 요청 DTO
 */
export class CreateQnaDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  productId: number;

  @ApiPropertyOptional({ description: '문의 제목', example: '재고 문의드립니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: '문의 내용', example: '이 상품 언제 재입고되나요?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: '문의 타입',
    enum: QuestionType,
    example: QuestionType.STOCK
  })
  @IsEnum(QuestionType)
  @IsNotEmpty()
  questionType: QuestionType;

  @ApiProperty({ description: '비밀글 여부', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiPropertyOptional({
    description: '이미지 URL 배열 (최대 5장)',
    example: ['https://example.com/image1.jpg'],
    maxItems: 5
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * Q&A 수정 요청 DTO
 */
export class UpdateQnaDto {
  @ApiPropertyOptional({ description: '문의 제목', example: '재고 문의드립니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '문의 내용', example: '이 상품 언제 재입고되나요?' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '문의 타입',
    enum: QuestionType
  })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({ description: '비밀글 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiPropertyOptional({
    description: '이미지 URL 배열 (최대 5장)',
    example: ['https://example.com/image1.jpg'],
    maxItems: 5
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * Q&A 답변 작성 요청 DTO (관리자용)
 */
export class CreateQnaAnswerDto {
  @ApiProperty({ description: '답변 내용', example: '해당 상품은 다음주 월요일에 재입고 예정입니다.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

/**
 * Q&A 조회 쿼리 DTO
 */
export class QnaQueryDto {
  @ApiPropertyOptional({ description: '상품 ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productId?: number;

  @ApiPropertyOptional({
    description: '문의 타입 필터',
    enum: QuestionType
  })
  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @ApiPropertyOptional({
    description: '답변 여부 필터',
    enum: QnaFilterType,
    default: QnaFilterType.ALL
  })
  @IsOptional()
  @IsEnum(QnaFilterType)
  filter?: QnaFilterType;

  @ApiPropertyOptional({
    description: '정렬 기준',
    enum: QnaSortType,
    default: QnaSortType.LATEST
  })
  @IsOptional()
  @IsEnum(QnaSortType)
  sort?: QnaSortType;

  @ApiPropertyOptional({ description: '페이지 번호', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '페이지당 항목 수', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

/**
 * Q&A 응답 DTO
 */
export class QnaResponseDto {
  @ApiProperty({ description: 'Q&A ID', example: 1 })
  id: number;

  @ApiProperty({ description: '상품 ID', example: 1 })
  productId: number;

  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '사용자 이름 (마스킹)', example: '홍*동' })
  userName: string;

  @ApiPropertyOptional({ description: '문의 제목', example: '재고 문의드립니다.' })
  title?: string;

  @ApiProperty({ description: '문의 내용', example: '이 상품 언제 재입고되나요?' })
  content: string;

  @ApiProperty({
    description: '문의 타입',
    enum: QuestionType,
    example: QuestionType.STOCK
  })
  questionType: QuestionType;

  @ApiProperty({ description: '비밀글 여부', example: false })
  isSecret: boolean;

  @ApiProperty({ description: '답변 여부', example: true })
  hasAnswer: boolean;

  @ApiPropertyOptional({ description: '답변 내용', example: '해당 상품은 다음주 월요일에 재입고 예정입니다.' })
  answer?: string;

  @ApiPropertyOptional({ description: '답변한 관리자 ID', example: 1 })
  answeredBy?: number;

  @ApiPropertyOptional({ description: '답변한 관리자 이름', example: '관리자' })
  answererName?: string;

  @ApiPropertyOptional({ description: '답변일시', example: '2024-01-15T10:00:00Z' })
  answeredAt?: string;

  @ApiProperty({ description: '생성일시', example: '2024-01-15T09:00:00Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: '수정일시', example: '2024-01-15T09:30:00Z' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: '상품 정보' })
  product?: {
    id: number;
    name: string;
    sku: string;
  };

  @ApiPropertyOptional({
    description: '이미지 URL 배열',
    example: ['https://example.com/image1.jpg']
  })
  mediaUrls?: string[];
}

/**
 * Q&A 목록 응답 DTO (페이지네이션)
 */
export class QnaPaginatedResponseDto {
  @ApiProperty({ description: 'Q&A 목록', type: [QnaResponseDto] })
  items: QnaResponseDto[];

  @ApiProperty({ description: '총 개수', example: 29 })
  total: number;

  @ApiProperty({ description: '현재 페이지', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 20 })
  limit: number;

  @ApiProperty({ description: '총 페이지 수', example: 2 })
  totalPages: number;

  @ApiProperty({ description: '답변 완료 개수', example: 15 })
  answeredCount: number;

  @ApiProperty({ description: '미답변 개수', example: 14 })
  unansweredCount: number;
}
