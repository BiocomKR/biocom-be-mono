import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 동물 이미지 DTO
 */
export class AnimalImageDto {
  @ApiProperty({ description: '이미지 타입', example: 'THUMBNAIL' })
  imageType: string;

  @ApiProperty({ description: '이미지 URL', example: 'https://...' })
  imageUrl: string;

  @ApiProperty({ description: '정렬 순서', example: 0 })
  sortOrder: number;
}

/**
 * 동물 상세 DTO
 */
export class HealthTypeAnimalDto {
  @ApiProperty({ description: '동물 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '건강 타입 코드', example: 'GUT_HEALTH' })
  healthType: string;

  @ApiProperty({ description: '타입 이름', example: '장건강' })
  typeName: string;

  @ApiProperty({ description: '동물 이름', example: '배빵빵 펭귄' })
  animalName: string;

  @ApiProperty({ description: '캐치프레이즈', example: '장 건강에 주의가 필요한 타입' })
  catchphrase: string;

  @ApiProperty({ description: '증상', example: '소화불량, 복부팽만' })
  symptoms: string;

  @ApiPropertyOptional({ description: '유형 설명' })
  description?: string;

  @ApiPropertyOptional({ description: '해결 방법' })
  solution?: string;

  @ApiPropertyOptional({ description: '대표 이미지 URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: '메타데이터 (synergyEffects, intakeGuide, dietRecommendation)' })
  metadata?: any;

  @ApiProperty({ description: '이미지 목록', type: [AnimalImageDto] })
  images: AnimalImageDto[];

  @ApiProperty({ description: '내 동물 여부', example: false })
  isMine: boolean;
}

/**
 * 동물 목록 응답 DTO
 */
export class HealthTypeAnimalListResponseDto {
  @ApiProperty({ description: '동물 목록', type: [HealthTypeAnimalDto] })
  animals: HealthTypeAnimalDto[];

  @ApiPropertyOptional({ description: '내 동물 ID (없으면 null)', example: 2 })
  myAnimalId: number | null;

  @ApiProperty({ description: '전체 동물 수', example: 8 })
  total: number;
}
