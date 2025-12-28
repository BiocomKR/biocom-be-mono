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

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  imageUrl?: string;

  @ApiProperty({ description: '정렬 순서' })
  sortOrder: number;

  @ApiPropertyOptional({ description: '정가' })
  originalPrice?: number;

  @ApiPropertyOptional({ description: '할인가' })
  price?: number;

}

/**
 * 식재료 레벨 정보 DTO (음식물 과민증 검사 결과 기반)
 */
export class IngredientLevelDto {
  @ApiProperty({ description: '1-3단계 식재료 (안전)', type: [String] })
  safe: string[];

  @ApiProperty({ description: '4-5단계 식재료 (주의)', type: [String] })
  caution: string[];
}

/**
 * 영양 정보 DTO
 */
export class NutritionDto {
  @ApiPropertyOptional({ description: '칼로리 (kcal)' })
  calories?: number;

  @ApiPropertyOptional({ description: '순탄수화물 (g)' })
  carbs?: number;

  @ApiPropertyOptional({ description: '단백질 (g)' })
  protein?: number;

  @ApiPropertyOptional({ description: '지방 (g)' })
  fat?: number;

  @ApiPropertyOptional({ description: '식이섬유 (g)' })
  fiber?: number;
}

/**
 * 영양제 추천 상품 DTO
 */
export class SupplementProductDto {
  @ApiProperty({ description: '상품 ID' })
  id: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiPropertyOptional({ description: '상품 이미지' })
  thumbnail?: string;

  @ApiProperty({ description: '상품 타입 (FORMULA: 맞춤솔루션, SUPPLEMENT: 단품 영양제)' })
  type: string;

  @ApiPropertyOptional({ description: '추천 키워드 (맞춤솔루션, 장건강 등)' })
  keyword?: string;

  @ApiPropertyOptional({ description: '정가' })
  originalPrice?: number;

  @ApiPropertyOptional({ description: '할인가' })
  price?: number;

  @ApiPropertyOptional({ description: '추천 이유' })
  recommendReason?: string;

  @ApiPropertyOptional({ description: '복용량' })
  dosage?: string;

  @ApiPropertyOptional({ description: '작용기전 목록 (SUPPLEMENT용)' })
  mechanisms?: any[];

  @ApiPropertyOptional({ description: '시너지 효과 (FORMULA용 - formulaName, formulaDescription, synergyEffects 포함)' })
  synergyEffects?: {
    formulaName?: string;
    formulaDescription?: string;
    synergyEffects?: any[];
  };

  @ApiPropertyOptional({ description: '맞춤 포뮬러 설명 (건강유형별, keyword가 맞춤포뮬러인 경우)' })
  formula?: string;

  @ApiProperty({ description: '정렬 순서' })
  displayOrder: number;
}

/**
 * 식단 추천 상품 DTO
 */
export class DietProductDto {
  @ApiProperty({ description: '상품 ID' })
  id: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiPropertyOptional({ description: '상품 이미지' })
  thumbnail?: string;

  @ApiPropertyOptional({ description: '정가' })
  originalPrice?: number;

  @ApiPropertyOptional({ description: '할인가' })
  price?: number;

  @ApiPropertyOptional({ description: '추천 이유' })
  recommendReason?: string;

  @ApiPropertyOptional({ description: '섭취량' })
  dosage?: string;

  @ApiProperty({ description: '라인업 정보', type: LineupDto })
  lineup: LineupDto;

  @ApiPropertyOptional({ description: '영양 정보', type: NutritionDto })
  nutrition?: NutritionDto;

  @ApiPropertyOptional({ description: '전체 식재료 목록', type: [String] })
  ingredients?: string[];

  @ApiPropertyOptional({ description: '식재료 레벨 정보 (음식물 과민증 결과 기반)', type: IngredientLevelDto })
  ingredientLevels?: IngredientLevelDto;

  @ApiProperty({ description: '섭취 가능 여부 (4,5단계 식재료 미포함 시 true)' })
  isEdible: boolean;

  @ApiProperty({ description: '정렬 순서' })
  displayOrder: number;
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
 * 식단 섭취 가이드 항목 DTO
 */
export class DietGuideItemDto {
  @ApiProperty({ description: '라벨 (루틴, 시너지)' })
  label: string;

  @ApiProperty({ description: '설명' })
  content: string;
}

/**
 * 식단 섭취 가이드 DTO
 */
export class DietGuideDto {
  @ApiPropertyOptional({ description: '섭취 루틴 (예: 최소 2주간 점심은 저포드맵, 저녁은 오리지널로...)' })
  routine?: string;

  @ApiPropertyOptional({ description: '시너지 효과 설명' })
  synergy?: string;

  @ApiPropertyOptional({ description: '가이드 항목 배열 (프론트 렌더링용)', type: [DietGuideItemDto] })
  items?: DietGuideItemDto[];
}

/**
 * 조건부 추천 상품 DTO (메타드림/리셋데이)
 */
export class ConditionalProductDto {
  @ApiProperty({ description: '상품 ID' })
  id: number;

  @ApiProperty({ description: '상품명' })
  name: string;

  @ApiPropertyOptional({ description: '상품 이미지' })
  thumbnail?: string;

  @ApiProperty({ description: '추천 조건 타입', example: 'SLEEP | GLUTEN' })
  conditionType: string;

  @ApiPropertyOptional({ description: '추천 키워드' })
  keyword?: string;

  @ApiPropertyOptional({ description: '정가' })
  originalPrice?: number;

  @ApiPropertyOptional({ description: '할인가' })
  price?: number;

  @ApiPropertyOptional({ description: '추천 이유' })
  recommendReason?: string;

  @ApiPropertyOptional({ description: '복용량' })
  dosage?: string;

  @ApiPropertyOptional({ description: '작용기전 목록' })
  mechanisms?: any[];

  @ApiProperty({ description: '추천 여부 (조건 충족 시 true)' })
  isRecommended: boolean;

  @ApiPropertyOptional({ description: '조건 점수 (수면: sleepScore, 글루텐: glutenLevel)' })
  conditionScore?: number;
}

/**
 * 맞춤 솔루션 전체 응답 DTO
 */
export class SolutionResponseDto {
  @ApiProperty({ description: '건강유형 동물 정보', type: HealthTypeAnimalDto })
  animal: HealthTypeAnimalDto;

  @ApiProperty({ description: '영양제 추천 목록', type: [SupplementProductDto] })
  supplements: SupplementProductDto[];

  @ApiProperty({ description: '식단 추천 목록', type: [DietProductDto] })
  diets: DietProductDto[];

  @ApiProperty({ description: '라인업 목록 (식단 필터용)', type: [LineupDto] })
  lineups: LineupDto[];

  @ApiPropertyOptional({ description: '식단 섭취 가이드 (건강유형별)', type: DietGuideDto })
  dietGuide?: DietGuideDto;

  @ApiPropertyOptional({ description: '조건부 추천 제품 (메타드림/리셋데이)', type: [ConditionalProductDto] })
  conditionalProducts?: ConditionalProductDto[];
}
