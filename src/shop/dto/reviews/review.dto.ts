import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsUrl,
  MaxLength,
  ArrayMaxSize
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ReviewType {
  TEXT = 'TEXT',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO'
}

export enum ReviewSortType {
  LATEST = 'latest',      // 최신순
  OLDEST = 'oldest',      // 오래된순
  RATING_HIGH = 'rating_high', // 별점 높은순
  RATING_LOW = 'rating_low',   // 별점 낮은순
  HELPFUL = 'helpful'     // 도움됨순
}

/**
 * 리뷰 작성 요청 DTO
 */
export class CreateReviewDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  productId: number;

  @ApiPropertyOptional({ description: '상품 옵션 ID (옵션이 있는 경우)', example: 1 })
  @IsOptional()
  @IsNumber()
  productOptionId?: number;

  @ApiPropertyOptional({ description: '리뷰 제목', example: '정말 좋은 제품입니다!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: '리뷰 내용', example: '한 달 사용해보니 효과가 정말 좋네요. 추천합니다!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '별점 (1~5)', example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: '리뷰 타입',
    enum: ReviewType,
    default: ReviewType.TEXT
  })
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiPropertyOptional({
    description: '리뷰 이미지 URL 배열 (최대 5장)',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    maxItems: 5
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * 리뷰 수정 요청 DTO
 */
export class UpdateReviewDto {
  @ApiPropertyOptional({ description: '리뷰 제목', example: '정말 좋은 제품입니다!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '리뷰 내용', example: '한 달 사용해보니 효과가 정말 좋네요. 추천합니다!' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '별점 (1~5)', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: '리뷰 타입',
    enum: ReviewType
  })
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiPropertyOptional({
    description: '리뷰 이미지 URL 배열 (최대 5장)',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    maxItems: 5
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * 리뷰 조회 쿼리 DTO
 */
export class ReviewQueryDto {
  @ApiPropertyOptional({ description: '상품 ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productId?: number;

  @ApiPropertyOptional({ description: '별점 필터', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: '리뷰 타입 필터',
    enum: ReviewType
  })
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiPropertyOptional({
    description: '베스트 리뷰만 조회',
    example: true
  })
  @IsOptional()
  isBest?: boolean;

  @ApiPropertyOptional({
    description: '정렬 기준',
    enum: ReviewSortType,
    default: ReviewSortType.LATEST
  })
  @IsOptional()
  @IsEnum(ReviewSortType)
  sort?: ReviewSortType;

  @ApiPropertyOptional({ description: '페이지 번호', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지당 항목 수', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * 리뷰 댓글 응답 DTO
 */
export class ReviewCommentResponseDto {
  @ApiProperty({ description: '댓글 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '리뷰 ID', example: 1 })
  reviewId: number;

  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '사용자 이름 (마스킹)', example: '홍*동' })
  userName: string;

  @ApiProperty({ description: '댓글 내용', example: '저도 이 제품 좋았어요!' })
  content: string;

  @ApiPropertyOptional({
    description: '미디어 URL 배열',
    example: ['https://example.com/image1.jpg']
  })
  mediaUrls?: string[];

  @ApiProperty({ description: '생성일시', example: '2024-01-15T10:00:00Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: '수정일시', example: '2024-01-15T11:00:00Z' })
  updatedAt?: string;
}

/**
 * 리뷰 응답 DTO
 */
export class ReviewResponseDto {
  @ApiProperty({ description: '리뷰 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '상품 ID', example: 1 })
  productId: number;

  @ApiPropertyOptional({ description: '상품 옵션 ID', example: 1 })
  productOptionId?: number;

  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '사용자 이름 (마스킹)', example: '홍*동' })
  userName: string;

  @ApiPropertyOptional({ description: '리뷰 제목', example: '정말 좋은 제품입니다!' })
  title?: string;

  @ApiProperty({ description: '리뷰 내용', example: '한 달 사용해보니 효과가 정말 좋네요. 추천합니다!' })
  content: string;

  @ApiProperty({ description: '별점 (1~5)', example: 5 })
  rating: number;

  @ApiProperty({ description: '리뷰 타입', enum: ReviewType, example: ReviewType.TEXT })
  reviewType: ReviewType;

  @ApiPropertyOptional({
    description: '미디어 URL 배열',
    example: ['https://example.com/image1.jpg']
  })
  mediaUrls?: string[];

  @ApiProperty({ description: '베스트 리뷰 여부', example: false })
  isBest: boolean;

  @ApiPropertyOptional({ description: '베스트 선정일시', example: '2024-01-15T10:00:00Z' })
  bestSelectedAt?: string;

  @ApiProperty({ description: '도움됨 수', example: 5 })
  helpfulCount: number;

  @ApiProperty({ description: '생성일시', example: '2024-01-15T10:00:00Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: '수정일시', example: '2024-01-15T11:00:00Z' })
  updatedAt?: string;

  @ApiProperty({ description: '상품 정보' })
  product: {
    id: number;
    name: string;
    sku: string;
  };

  @ApiProperty({ description: '상품 옵션 정보' })
  productOption: {
    id: number;
    optionName: string;
    price: number;
  };

  @ApiPropertyOptional({ description: '댓글 목록', type: [ReviewCommentResponseDto] })
  comments?: ReviewCommentResponseDto[];

  @ApiPropertyOptional({ description: '댓글 수', example: 5 })
  commentCount?: number;
}

/**
 * 리뷰 목록 응답 DTO (페이지네이션)
 */
export class ReviewPaginatedResponseDto {
  @ApiProperty({ description: '리뷰 목록', type: [ReviewResponseDto] })
  items: ReviewResponseDto[];

  @ApiProperty({ description: '총 개수', example: 150 })
  total: number;

  @ApiProperty({ description: '현재 페이지', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 20 })
  limit: number;

  @ApiProperty({ description: '총 페이지 수', example: 8 })
  totalPages: number;

  @ApiProperty({ description: '별점 통계' })
  ratingStats: {
    averageRating: number;
    totalCount: number;
    rating1Count: number;
    rating2Count: number;
    rating3Count: number;
    rating4Count: number;
    rating5Count: number;
  };
}

/**
 * 리뷰 도움됨 토글 응답 DTO
 */
export class ReviewHelpfulResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '현재 도움됨 수', example: 6 })
  helpfulCount: number;

  @ApiProperty({ description: '사용자가 도움됨을 눌렀는지', example: true })
  isHelpful: boolean;
}

/**
 * 리뷰 댓글 작성 요청 DTO
 */
export class CreateReviewCommentDto {
  @ApiProperty({ description: '댓글 내용', example: '저도 이 제품 좋았어요!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: '댓글 이미지 URL 배열 (최대 3장)',
    example: ['https://example.com/image1.jpg'],
    maxItems: 3
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * 리뷰 댓글 수정 요청 DTO
 */
export class UpdateReviewCommentDto {
  @ApiPropertyOptional({ description: '댓글 내용', example: '저도 이 제품 좋았어요!' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '댓글 이미지 URL 배열 (최대 3장)',
    example: ['https://example.com/image1.jpg'],
    maxItems: 3
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];
}

/**
 * 리뷰 댓글 목록 응답 DTO (페이지네이션)
 */
export class ReviewCommentPaginatedResponseDto {
  @ApiProperty({ description: '댓글 목록', type: [ReviewCommentResponseDto] })
  items: ReviewCommentResponseDto[];

  @ApiProperty({ description: '총 개수', example: 25 })
  total: number;

  @ApiProperty({ description: '현재 페이지', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 20 })
  limit: number;

  @ApiProperty({ description: '총 페이지 수', example: 2 })
  totalPages: number;
}