import { ApiProperty } from '@nestjs/swagger';

/**
 * 카테고리 응답 DTO
 */
export class CategoryResponseDto {
  @ApiProperty({ description: '카테고리 ID' })
  id: number;

  @ApiProperty({ description: '상위 카테고리 ID', nullable: true })
  parentId: number | null;

  @ApiProperty({ description: '카테고리명' })
  name: string;

  @ApiProperty({ description: 'URL 슬러그' })
  slug: string;

  @ApiProperty({ description: '전체 경로', nullable: true })
  path: string | null;

  @ApiProperty({ description: '계층 깊이' })
  depth: number;

  @ApiProperty({ description: '정렬 순서' })
  sortOrder: number;

  @ApiProperty({ description: '활성화 여부' })
  isActive: boolean;

  @ApiProperty({ description: '하위 카테고리', type: [CategoryResponseDto], required: false })
  children?: CategoryResponseDto[];

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정일시', nullable: true })
  updatedAt: Date | null;
}

/**
 * 카테고리별 상품 수 포함 응답 DTO
 */
export class CategoryWithCountDto extends CategoryResponseDto {
  @ApiProperty({ description: '카테고리 내 상품 수' })
  productCount: number;
}