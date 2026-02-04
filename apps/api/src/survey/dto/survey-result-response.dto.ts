import { ApiProperty } from '@nestjs/swagger';

export class SurveyResultResponseDto {
  @ApiProperty({ description: '결과 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '설문 타입', example: 'before', enum: ['before', 'after'] })
  type: string;

  @ApiProperty({ description: '피부 건강 점수', example: 85 })
  skinHealthScore: number;

  @ApiProperty({ description: '대사 밸런스 점수', example: 72 })
  metabolismScore: number;

  @ApiProperty({ description: '면역/알러지 반응 점수', example: 90 })
  immuneBalanceScore: number;

  @ApiProperty({ description: '장 건강 점수', example: 68 })
  gutHealthScore: number;

  @ApiProperty({ description: '전체 평균 점수', example: 79 })
  totalScore: number;

  @ApiProperty({ 
    description: '사용자 동물 타입 (가장 낮은 점수 카테고리 기준)', 
    example: '배 빵빵 펭귄'
  })
  animal: string;

  @ApiProperty({ 
    description: '카테고리 타입', 
    example: '장형',
    required: false
  })
  categoryType?: string;

  @ApiProperty({ 
    description: '캐릭터 & 핵심 키워드', 
    example: '당신은 배빵빵 펭귄입니다...',
    required: false
  })
  characterKeyword?: string;

  @ApiProperty({ 
    description: '특징 상세', 
    example: '식사 30분 뒤 배가 불러오고...',
    required: false
  })
  detailedFeatures?: string;

  @ApiProperty({ description: '계산 일시', example: '2024-01-13T10:00:00Z' })
  calculatedAt: Date;

  @ApiProperty({ description: '생성 일시', example: '2024-01-13T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시', example: '2024-01-13T10:00:00Z', required: false })
  updatedAt: Date | null;
}

export class SurveyComparisonResponseDto {
  @ApiProperty({ description: '사전 설문 결과' })
  before: SurveyResultResponseDto | null;

  @ApiProperty({ description: '사후 설문 결과' })
  after: SurveyResultResponseDto | null;

  @ApiProperty({ 
    description: '개선 정보',
    required: false,
    example: {
      skinHealthImprovement: 15,
      metabolismImprovement: 8,
      immuneBalanceImprovement: -3,
      gutHealthImprovement: 22,
      totalImprovement: 10.5
    }
  })
  improvements?: {
    skinHealthImprovement: number;
    metabolismImprovement: number;
    immuneBalanceImprovement: number;
    gutHealthImprovement: number;
    totalImprovement: number;
  };
}