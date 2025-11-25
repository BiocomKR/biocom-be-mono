import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 리뷰 요약 정보 DTO
 */
export class ReviewSummaryDto {
  @ApiProperty({ description: '총 리뷰 수', example: 169 })
  totalCount: number;

  @ApiProperty({ description: '평균 별점', example: 5.0 })
  averageRating: number;

  @ApiProperty({ description: '별점 1점 개수', example: 0 })
  rating1Count: number;

  @ApiProperty({ description: '별점 2점 개수', example: 0 })
  rating2Count: number;

  @ApiProperty({ description: '별점 3점 개수', example: 5 })
  rating3Count: number;

  @ApiProperty({ description: '별점 4점 개수', example: 20 })
  rating4Count: number;

  @ApiProperty({ description: '별점 5점 개수', example: 144 })
  rating5Count: number;

  @ApiProperty({ description: '포토 리뷰 수', example: 45 })
  photoReviewCount: number;
}

/**
 * Q&A 요약 정보 DTO
 */
export class QnaSummaryDto {
  @ApiProperty({ description: '총 Q&A 수', example: 29 })
  totalCount: number;

  @ApiProperty({ description: '답변 완료 개수', example: 15 })
  answeredCount: number;

  @ApiProperty({ description: '미답변 개수', example: 14 })
  unansweredCount: number;
}

/**
 * 상품 상세 정보 DTO (간소화 버전)
 * 상품 기본 정보 + 리뷰/Q&A 요약만 포함
 */
export class ProductDetailDto {
  @ApiProperty({ description: '상품 ID', example: 11 })
  id: number;

  @ApiProperty({ description: '카테고리 코드', example: 'SUPPLEMENT' })
  categoryCode: string;

  @ApiProperty({ description: '카테고리명', example: '영양제' })
  categoryName: string;

  @ApiProperty({ description: '상품명', example: '팀키토 방탄젤리 청포도맛 (15포)' })
  name: string;

  @ApiPropertyOptional({ description: '상품 설명', example: '식후 혈당이 걱정이라면?' })
  description?: string;

  @ApiProperty({ description: '상품 타입 (SINGLE/SET)', example: 'SINGLE' })
  productType: string;

  @ApiPropertyOptional({ description: '세트 구성 정보 (JSON)', example: null })
  setItems?: any;

  @ApiProperty({ description: '상태 (ACTIVE/INACTIVE/SOLD_OUT)', example: 'ACTIVE' })
  status: string;

  @ApiProperty({ description: '조회수', example: 0 })
  viewCount: number;

  @ApiProperty({ description: '상품 이미지 URL 배열', type: [String], example: ['https://cdn.imweb.me/thumbnail/20250430/d37b234c0db50.png'] })
  imageUrl: string[];

  @ApiPropertyOptional({ description: '정가', example: 30000 })
  originalPrice?: number;

  @ApiProperty({ description: '판매가', example: 22900 })
  price: number;

  @ApiProperty({ description: '리뷰 요약 정보', type: ReviewSummaryDto })
  reviewSummary: ReviewSummaryDto;

  @ApiProperty({ description: 'Q&A 요약 정보', type: QnaSummaryDto })
  qnaSummary: QnaSummaryDto;
}
