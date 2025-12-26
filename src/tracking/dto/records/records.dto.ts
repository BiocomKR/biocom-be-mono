import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsDateString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

/**
 * 뷰티 질문 응답 DTO
 *
 * 점수 체계 (낮을수록 건강함):
 * - 그렇다 (최상): 5점
 * - 그런편이다: 10점
 * - 보통이다: 15점
 * - 아닌편이다: 20점
 * - 아니다 (최하): 25점
 */
export class BeautyQuestionDto {
  @ApiProperty({ description: '질문 번호', example: 1 })
  @IsNumber()
  no: number;

  @ApiProperty({
    description: '점수 (5=그렇다, 10=그런편이다, 15=보통이다, 20=아닌편이다, 25=아니다)',
    example: 5,
    enum: [5, 10, 15, 20, 25]
  })
  @IsNumber()
  score: number;
}

/**
 * 뷰티 기록 DTO
 * 이너뷰티(4개 질문) + 아우터뷰티(4개 질문) = 총 8개 질문
 *
 * 점수 범위:
 * - 이너뷰티: 20~100점 (낮을수록 건강)
 * - 아우터뷰티: 20~100점 (낮을수록 건강)
 * - 총점: 40~200점 (낮을수록 건강)
 */
export class CreateBeautyRecordDto {
  @ApiProperty({
    description: '이너뷰티 4개 질문에 대한 응답',
    type: [BeautyQuestionDto],
    example: [
      { no: 1, score: 5 },
      { no: 2, score: 10 },
      { no: 3, score: 15 },
      { no: 4, score: 5 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeautyQuestionDto)
  innerBeauty: BeautyQuestionDto[];

  @ApiProperty({
    description: '아우터뷰티 4개 질문에 대한 응답',
    type: [BeautyQuestionDto],
    example: [
      { no: 1, score: 5 },
      { no: 2, score: 10 },
      { no: 3, score: 15 },
      { no: 4, score: 5 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeautyQuestionDto)
  outerBeauty: BeautyQuestionDto[];
}

/**
 * 식사 종류 enum
 */
export enum DietType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  LATENIGHT = 'LATENIGHT'
}

/**
 * 과민식품 DTO
 */
export class AllergyFoodDto {
  @ApiProperty({ description: '과민식품명', example: '오징어' })
  @IsString()
  name: string;

  @ApiProperty({ description: '과민 단계 (1-5)', example: 4 })
  @IsNumber()
  @Min(1)
  @Max(5)
  level: number;
}

/**
 * 식단 기록 DTO (새로운 구조)
 * 단일 식품을 한 번에 등록하는 방식
 * isFasting이 true인 경우 식품 정보 없이 공복 식사 기록 가능
 */
export class CreateDietRecordDto {
  @ApiProperty({
    description: '식사 종류',
    enum: DietType,
    example: DietType.BREAKFAST
  })
  @IsString()
  diet: DietType;

  @ApiProperty({
    description: '공복 여부 (true인 경우 식품 정보 없이 저장)',
    example: false,
    required: false
  })
  @IsOptional()
  isFasting?: boolean;

  @ApiProperty({ description: '식품명', example: '무화과 샐러드', required: false })
  @IsOptional()
  @IsString()
  foodName?: string;

  @ApiProperty({
    description: '식품 이미지 URL',
    example: 'https://example.com/image.jpg',
    required: false
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: '과민식품 목록',
    type: [AllergyFoodDto],
    example: [
      { name: '오징어', level: 4 },
      { name: '밀가루', level: 3 }
    ],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyFoodDto)
  allergyFoods?: AllergyFoodDto[];

  @ApiProperty({
    description: '고포드맵식품 목록',
    type: [String],
    example: ['사과', '우유'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highFodmapFoods?: string[];

  @ApiProperty({
    description: '가공식품 목록',
    type: [String],
    example: ['젤리', '사탕'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  processedFoods?: string[];
}

/**
 * 영양제 섭취 기록 DTO (신규)
 * 루틴 기반 영양제 기록
 */
export class CreateSupplementRecordDto {
  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2025-11-19'
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: '영양제 상품 ID',
    example: 1
  })
  @IsNumber()
  productId: number;

  @ApiProperty({
    description: '회차 (1~10, 실제로는 1~3만 사용)',
    example: 3,
    minimum: 1,
    maximum: 10
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  count: number;

  @ApiProperty({
    description: '사진인증 URL (당일 첫 기록시 필수, 이후 선택)',
    example: 'https://example.com/supplement-photo.jpg',
    required: false
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

/**
 * 영양소 정보 DTO
 */
export class NutrientDto {
  @ApiProperty({ description: '영양소명', example: '비타민A' })
  name: string;

  @ApiProperty({ description: '함량', example: 700 })
  amount: number;

  @ApiProperty({ description: '단위', example: 'mg' })
  unit: string;

  @ApiProperty({ description: 'RDA 비율 (%)', example: 100, required: false })
  rda?: number;
}

/**
 * 간헐적 단식 기록 DTO
 * 공복 시작/종료 날짜+시간 기록
 */
export class CreateFastingRecordDto {
  @ApiProperty({
    description: '공복 시작 날짜+시간 (YYYY-MM-DD HH:mm:ss 형식, 어제 또는 오늘만 가능)',
    example: '2025-11-02 20:00:00'
  })
  @IsString()
  startDateTime: string;

  @ApiProperty({
    description: '공복 종료 날짜+시간 (YYYY-MM-DD HH:mm:ss 형식, 오늘만 가능)',
    example: '2025-11-03 12:00:00'
  })
  @IsString()
  endDateTime: string;
}

/**
 * 수면 기록 DTO
 * 잠든 시간과 기상 시간 날짜+시간 기록
 */
export class CreateSleepRecordDto {
  @ApiProperty({
    description: '잠든 날짜+시간 (YYYY-MM-DD HH:mm:ss 형식, 어제 또는 오늘만 가능)',
    example: '2025-11-02 23:30:00'
  })
  @IsString()
  bedDateTime: string;

  @ApiProperty({
    description: '기상 날짜+시간 (YYYY-MM-DD HH:mm:ss 형식, 오늘만 가능)',
    example: '2025-11-03 07:00:00'
  })
  @IsString()
  wakeDateTime: string;
}

/**
 * 운동 종목 정보 DTO
 */
export class ActivityTypeDto {
  @ApiProperty({ description: '운동 종목 코드', example: 'RUNNING' })
  @IsString()
  code: string;

  @ApiProperty({ description: '운동 종목명', example: '달리기' })
  @IsString()
  name: string;

  @ApiProperty({ description: '칼로리 계수 (10분당)', example: 100 })
  @IsNumber()
  calorie_rate: number;

  @ApiProperty({ description: '기준 시간 (분)', example: 10 })
  @IsNumber()
  base_minutes: number;
}

/**
 * 활동 기록 DTO
 * 운동 종목, 시간, 인증사진을 포함한 새로운 구조
 */
export class CreateActivityRecordDto {
  @ApiProperty({
    description: 'exercise_types 테이블의 운동 종목 정보',
    type: ActivityTypeDto,
    example: {
      code: 'RUNNING',
      name: '달리기',
      calorie_rate: 100,
      base_minutes: 10
    }
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ActivityTypeDto)
  activityType: ActivityTypeDto;

  @ApiProperty({
    description: '운동 시간 (HH:MM:SS 형식)',
    example: '01:30:00'
  })
  @IsString()
  activityTime: string;

  @ApiProperty({
    description: '운동 인증사진 URL (필수)',
    example: 'https://example.com/my-workout-photo.jpg'
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  // TODO: 앱에서 보내지만 서버에서는 무시됨 (서버 기준 오늘 날짜 사용). 추후 앱과 함께 제거 검토
  @ApiPropertyOptional({
    description: '기록 날짜 (YYYY-MM-DD 형식) - 서버에서 무시됨',
    example: '2025-12-18'
  })
  @IsOptional()
  @IsString()
  date?: string;
}

/**
 * 기록 데이터 타입 정의
 */
export interface RecordData {
  id: number;
  recordType: string;
  date: string;
  pointsEarned: number;
  metadata?: any;
}

/**
 * 기록 응답 DTO
 * ApiResponseDto를 상속하여 일관성 유지
 */
export class RecordResponseDto extends ApiResponseDto<RecordData> {
  @ApiProperty({
    description: '기록 데이터',
    example: {
      id: 123,
      recordType: 'BEAUTY',
      date: '2024-01-15',
      pointsEarned: 100
    }
  })
  data: RecordData;
}

/**
 * 기록 목록 응답 DTO
 */
export class RecordItemDto {
  @ApiProperty({ description: '기록 ID', example: 123 })
  id: number;

  @ApiProperty({ description: '기록 유형', example: 'BEAUTY' })
  recordType: string;

  @ApiProperty({ description: '기록 날짜', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: '기록 데이터', example: {} })
  metadata: any;

  @ApiProperty({ description: '생성일시', example: '2024-01-15T09:00:00Z' })
  createdAt: string;
}

/**
 * 기록 목록 응답 DTO  
 * ApiResponseDto를 상속하고 total 정보 추가
 */
export class RecordListResponseDto extends ApiResponseDto<RecordItemDto[]> {
  @ApiProperty({
    description: '기록 목록',
    type: [RecordItemDto]
  })
  data: RecordItemDto[];

  @ApiProperty({ description: '총 개수', example: 5 })
  total: number;
}