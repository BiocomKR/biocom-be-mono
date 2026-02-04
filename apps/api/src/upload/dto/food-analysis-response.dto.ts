import { ApiProperty } from '@nestjs/swagger';

/**
 * 개별 음식 항목 정보 DTO (FastAPI 구조와 일치)
 */
export class FoodItemDto {
  @ApiProperty({ 
    description: '음식명',
    example: '김치찌개' 
  })
  name: string;

  @ApiProperty({ 
    description: '분량',
    example: '1인분' 
  })
  portion: string;

  @ApiProperty({ 
    description: '칼로리 (kcal)',
    example: 250 
  })
  calories: number;

  @ApiProperty({ 
    description: '단백질 (g)',
    example: 15.5 
  })
  protein: number;

  @ApiProperty({ 
    description: '탄수화물 (g)',
    example: 20.3 
  })
  carbs: number;

  @ApiProperty({ 
    description: '지방 (g)',
    example: 8.7 
  })
  fat: number;
}

/**
 * 총 영양소 정보 DTO (FastAPI 구조와 일치)
 */
export class NutritionTotalDto {
  @ApiProperty({ 
    description: '총 칼로리 (kcal)',
    example: 250 
  })
  calories: number;

  @ApiProperty({ 
    description: '총 단백질 (g)',
    example: 15.5 
  })
  protein: number;

  @ApiProperty({ 
    description: '총 탄수화물 (g)',
    example: 20.3 
  })
  carbs: number;

  @ApiProperty({ 
    description: '총 지방 (g)',
    example: 8.7 
  })
  fat: number;
}

/**
 * 음식 이미지 분석 응답 DTO (FastAPI 구조와 일치)
 */
export class FoodAnalysisResponseDto {
  @ApiProperty({ 
    description: '음식 항목 목록',
    type: [FoodItemDto],
    example: [
      {
        name: '김치찌개',
        portion: '1인분',
        calories: 250,
        protein: 15.5,
        carbs: 20.3,
        fat: 8.7
      }
    ]
  })
  food_items: FoodItemDto[];

  @ApiProperty({ 
    description: '총 영양소 정보',
    type: NutritionTotalDto,
    example: {
      calories: 250,
      protein: 15.5,
      carbs: 20.3,
      fat: 8.7
    }
  })
  total: NutritionTotalDto;

  @ApiProperty({ 
    description: '에러 메시지 (분석 실패 시)',
    required: false,
    nullable: true,
    example: null
  })
  errorMessage?: string | null;

  @ApiProperty({ 
    description: '처리된 음식 이미지 URL',
    required: false,
    nullable: true,
    example: 'https://storage.googleapis.com/biocom-file-storage/food-calorie_2025-09-10T12-34-56-789Z_food.jpg'
  })
  imageUrl?: string | null;

  @ApiProperty({
    description: '파일 저장 위치',
    required: false,
    nullable: true,
    enum: ['google-storage', 'local-fallback'],
    example: 'google-storage'
  })
  storageLocation?: 'google-storage' | 'local-fallback' | null;
}