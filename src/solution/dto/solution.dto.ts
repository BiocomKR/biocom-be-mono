import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 라인업 응답 DTO
 */
export class LineupDto {
  @ApiProperty({ description: '라인업 ID' })
  id: number;

  @ApiProperty({ description: '라인업 키 (ORIGINAL, SIGNATURE 등)' })
  key: string;

  @ApiProperty({ description: '라인업명' })
  name: string;

  @ApiPropertyOptional({ description: '설명' })
  description?: string;

  @ApiProperty({ description: '정렬 순서' })
  sortOrder: number;
}

/**
 * 알레르겐 응답 DTO
 */
export class IngredientDto {
  @ApiProperty({ description: '알레르겐 ID' })
  id: number;

  @ApiProperty({ description: '알레르겐 키 (milk, soybean 등)' })
  key: string;

  @ApiProperty({ description: '알레르겐 코드' })
  code: string;

  @ApiProperty({ description: '알레르겐명' })
  name: string;

  @ApiPropertyOptional({ description: '영문명' })
  nameEn?: string;

  @ApiPropertyOptional({ description: '카테고리' })
  category?: string;
}

/**
 * 영양 정보 DTO
 */
export class NutritionDto {
  @ApiPropertyOptional({ description: '칼로리 (kcal)' })
  calories?: number;

  @ApiPropertyOptional({ description: '순탄수화물 (g)' })
  netCarbs?: number;

  @ApiPropertyOptional({ description: '단백질 (g)' })
  protein?: number;

  @ApiPropertyOptional({ description: '지방 (g)' })
  fat?: number;

  @ApiPropertyOptional({ description: '식이섬유 (g)' })
  fiber?: number;
}

/**
 * 추천 상품 DTO (영양제/식단 공통)
 */
export class RecommendProductDto {
  @ApiProperty({ description: '상품 ID' })
  id: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiPropertyOptional({ description: '상품 이미지' })
  thumbnail?: string;

  @ApiPropertyOptional({ description: '추천 키워드' })
  keyword?: string;

  @ApiPropertyOptional({ description: '추천 이유' })
  recommendReason?: string;

  @ApiPropertyOptional({ description: '복용량/섭취량' })
  dosage?: string;

  @ApiPropertyOptional({ description: '작용기전 목록' })
  mechanisms?: string[];

  @ApiPropertyOptional({ description: '우선순위' })
  priority?: number;

  @ApiPropertyOptional({ description: '라인업 정보 (식단용)', type: LineupDto })
  lineup?: LineupDto;

  @ApiPropertyOptional({ description: '영양 정보 (식단용)', type: NutritionDto })
  nutrition?: NutritionDto;

  @ApiPropertyOptional({ description: '포함된 알레르겐 (식단용)', type: [IngredientDto] })
  allergens?: IngredientDto[];
}

/**
 * 건강유형 동물 DTO
 */
export class HealthTypeAnimalDto {
  @ApiProperty({ description: '건강유형 코드 (penguin, hedgehog 등)' })
  healthType: string;

  @ApiProperty({ description: '유형명' })
  typeName: string;

  @ApiProperty({ description: '동물명' })
  animalName: string;

  @ApiPropertyOptional({ description: '설명' })
  description?: string;

  @ApiPropertyOptional({ description: '솔루션 설명' })
  solution?: string;

  @ApiPropertyOptional({ description: '이미지 URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: '메타데이터 (시너지 효과, 섭취 가이드 등)' })
  metadata?: {
    synergyEffects?: string[];
    intakeGuide?: string[];
    cautions?: string[];
  };
}

/**
 * 탭별 추천 목록 DTO
 */
export class TabRecommendationsDto {
  @ApiProperty({ description: 'CORE 추천 상품', type: [RecommendProductDto] })
  core: RecommendProductDto[];

  @ApiProperty({ description: 'PLUS 추천 상품', type: [RecommendProductDto] })
  plus: RecommendProductDto[];

  @ApiProperty({ description: 'CONDITION 추천 상품', type: [RecommendProductDto] })
  condition: RecommendProductDto[];
}

/**
 * 맞춤 솔루션 전체 응답 DTO
 */
export class SolutionResponseDto {
  @ApiProperty({ description: '건강유형 동물 정보', type: HealthTypeAnimalDto })
  animal: HealthTypeAnimalDto;

  @ApiProperty({ description: '영양제 추천 목록', type: TabRecommendationsDto })
  supplements: TabRecommendationsDto;

  @ApiProperty({ description: '식단 추천 목록', type: TabRecommendationsDto })
  diets: TabRecommendationsDto;

  @ApiProperty({ description: '라인업 목록 (식단 필터용)', type: [LineupDto] })
  lineups: LineupDto[];

  @ApiProperty({ description: '알레르겐 목록 (식단 필터용)', type: [IngredientDto] })
  allergens: IngredientDto[];

  @ApiPropertyOptional({ description: '조건부 추천 (메타드림/리셋데이)' })
  conditionalProducts?: {
    metadream?: {
      productId: number;
      name: string;
      description: string;
      thumbnail?: string;
    };
    resetDay?: {
      productId: number;
      name: string;
      description: string;
      thumbnail?: string;
    };
  };
}
