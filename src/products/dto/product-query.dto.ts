import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SOLD_OUT = 'SOLD_OUT',
}

export enum ProductSort {
  CREATED_AT = 'created_at',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME = 'name',
  VIEW_COUNT = 'view_count',
}

/**
 * 상품 목록 조회 쿼리 DTO
 */
export class ProductQueryDto {
  @ApiPropertyOptional({ description: '카테고리 ID' })
  @IsOptional()
  @IsNumberString()
  category_id?: string;

  @ApiPropertyOptional({ description: '상품 상태', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: '추천 상품 여부' })
  @IsOptional()
  featured?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: '정렬 기준', enum: ProductSort })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: '페이지당 항목 수', default: 20 })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}