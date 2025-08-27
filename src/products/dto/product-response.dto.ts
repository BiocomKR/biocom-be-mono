import { ApiProperty } from '@nestjs/swagger';

/**
 * 상품 옵션 응답 DTO
 */
export class ProductOptionDto {
  @ApiProperty({ description: '옵션 ID' })
  id: number;

  @ApiProperty({ description: '옵션별 SKU' })
  sku: string;

  @ApiProperty({ description: '옵션명' })
  optionName: string;

  @ApiProperty({ description: '옵션값', nullable: true })
  optionValue: string | null;

  @ApiProperty({ description: '가격' })
  price: number;

  @ApiProperty({ description: '최대 주문 수량' })
  maxOrderQty: number;

  @ApiProperty({ description: '활성화 여부' })
  isActive: boolean;

  @ApiProperty({ description: '정렬 순서' })
  sortOrder: number;
}

/**
 * 상품 이미지 응답 DTO
 */
export class ProductImageDto {
  @ApiProperty({ description: '이미지 ID' })
  id: number;

  @ApiProperty({ description: '이미지 URL' })
  imageUrl: string;

  @ApiProperty({ description: '이미지 타입 (MAIN/SUB/DETAIL)' })
  imageType: string;

  @ApiProperty({ description: '정렬 순서' })
  sortOrder: number;

  @ApiProperty({ description: '대체 텍스트', nullable: true })
  altText: string | null;
}

/**
 * 상품 응답 DTO
 */
export class ProductResponseDto {
  @ApiProperty({ description: '상품 ID' })
  id: number;

  @ApiProperty({ description: '상품 SKU' })
  sku: string;

  @ApiProperty({ description: '카테고리 ID' })
  categoryId: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiProperty({ description: 'URL 슬러그' })
  slug: string;

  @ApiProperty({ description: '상품 설명', nullable: true })
  description: string | null;

  @ApiProperty({ description: '상품 타입 (SINGLE/SET)' })
  productType: string;

  @ApiProperty({ description: '세트 구성 정보', nullable: true })
  setItems: any;

  @ApiProperty({ description: '상품 상세 정보', nullable: true })
  productInfo: any;

  @ApiProperty({ description: '상태 (ACTIVE/INACTIVE/SOLD_OUT)' })
  status: string;

  @ApiProperty({ description: '추천 상품 여부' })
  isFeatured: boolean;

  @ApiProperty({ description: '조회수' })
  viewCount: number;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정일시', nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ description: '카테고리 정보', required: false })
  category?: any;

  @ApiProperty({ description: '상품 옵션', type: [ProductOptionDto], required: false })
  options?: ProductOptionDto[];

  @ApiProperty({ description: '상품 이미지', type: [ProductImageDto], required: false })
  images?: ProductImageDto[];

  @ApiProperty({ description: '최저가격', required: false })
  minPrice?: number;

  @ApiProperty({ description: '최고가격', required: false })
  maxPrice?: number;
}

/**
 * 상품 목록 페이지네이션 응답 DTO
 */
export class ProductPaginatedResponseDto {
  @ApiProperty({ description: '상품 목록', type: [ProductResponseDto] })
  items: ProductResponseDto[];

  @ApiProperty({ description: '전체 항목 수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}

/**
 * 재고 확인 요청 DTO
 */
export class CheckStockRequestDto {
  @ApiProperty({ 
    description: '재고 확인 항목',
    example: [{ sku: 'P001', quantity: 2 }]
  })
  items: Array<{
    sku: string;
    quantity: number;
  }>;
}

/**
 * 재고 확인 응답 DTO
 */
export class CheckStockResponseDto {
  @ApiProperty({ 
    description: '재고 확인 결과',
    example: [{ sku: 'P001', available: true, stock: 50 }]
  })
  items: Array<{
    sku: string;
    available: boolean;
    stock: number;
  }>;
}