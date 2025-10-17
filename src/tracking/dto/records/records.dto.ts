import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsDateString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

/**
 * 뷰티 질문 응답 DTO
 */
export class BeautyQuestionDto {
  @ApiProperty({ description: '질문 번호', example: 1 })
  @IsNumber()
  no: number;

  @ApiProperty({ description: '점수 (1-5점)', example: 3 })
  @IsNumber()
  @Min(1)
  @Max(5)
  score: number;
}

/**
 * 뷰티 기록 DTO
 * 이너뷰티(4개 질문) + 아우터뷰티(4개 질문) = 총 8개 질문
 */
export class CreateBeautyRecordDto {
  @ApiProperty({
    description: '이너뷰티 4개 질문에 대한 응답',
    type: [BeautyQuestionDto],
    example: [
      { no: 1, score: 3 },
      { no: 2, score: 2 },
      { no: 3, score: 5 },
      { no: 4, score: 1 }
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
      { no: 1, score: 3 },
      { no: 2, score: 2 },
      { no: 3, score: 5 },
      { no: 4, score: 1 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeautyQuestionDto)
  outerBeauty: BeautyQuestionDto[];

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2024-01-15',
    required: false
  })
  @IsOptional()
  @IsDateString()
  date?: string;
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
 */
export class CreateDietRecordDto {
  @ApiProperty({
    description: '식사 종류',
    enum: DietType,
    example: DietType.BREAKFAST
  })
  @IsString()
  diet: DietType;

  @ApiProperty({ description: '식품명', example: '무화과 샐러드' })
  @IsString()
  foodName: string;

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
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyFoodDto)
  allergyFoods: AllergyFoodDto[];

  @ApiProperty({
    description: '고포드맵식품 목록',
    type: [String],
    example: ['사과', '우유']
  })
  @IsArray()
  @IsString({ each: true })
  highFodmapFoods: string[];

  @ApiProperty({
    description: '가공식품 목록',
    type: [String],
    example: ['젤리', '사탕']
  })
  @IsArray()
  @IsString({ each: true })
  processedFoods: string[];

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2025-09-17',
    required: false
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

/**
 * 영양제 선택 항목 DTO
 * 상품 테이블 영양제 또는 커스텀 영양제
 */
export class SelectedSupplementDto {
  @ApiProperty({ description: '영양제 타입', enum: ['PRODUCT', 'CUSTOM'], example: 'PRODUCT' })
  @IsString()
  type: 'PRODUCT' | 'CUSTOM';

  @ApiProperty({ description: '상품 ID (type이 PRODUCT인 경우)', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  productId?: number;

  @ApiProperty({ description: '커스텀 영양제 ID (type이 CUSTOM인 경우)', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  customSupplementId?: number;

  @ApiProperty({ description: '영양제명', example: '비타민D' })
  @IsString()
  name: string;

  @ApiProperty({ description: '용량/함량', example: '1000IU', required: false })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiProperty({ description: '섭취 여부', example: true })
  @IsNotEmpty()
  taken: boolean;
}

/**
 * 영양제 섭취 기록 DTO (새로운 구조)
 * 복용시간 + 선택된 영양제 리스트 + 사진인증
 */
export class CreateSupplementRecordDto {
  @ApiProperty({ description: '복용 시간', example: '09:00' })
  @IsString()
  time: string;

  @ApiProperty({
    description: '선택된 영양제 목록',
    type: [SelectedSupplementDto],
    example: [
      { type: 'PRODUCT', productId: 1, name: '풍성한씨스', dosage: '1일 3정', taken: true },
      { type: 'CUSTOM', customSupplementId: 1, name: '비타민D', dosage: '1000IU', taken: false }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedSupplementDto)
  supplements: SelectedSupplementDto[];

  @ApiProperty({
    description: '사진인증 URL (필수)',
    example: 'https://example.com/supplement-photo.jpg'
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2025-09-18',
    required: false
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

/**
 * 커스텀 영양제 생성 DTO
 */
export class CreateCustomSupplementDto {
  @ApiProperty({ description: '영양제명', example: '비타민D' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '용량/함량', example: '1000IU', required: false })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiProperty({ description: '메모', example: '아침 식후 복용', required: false })
  @IsOptional()
  @IsString()
  memo?: string;
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
 * 커스텀 영양제 응답 DTO
 */
export class CustomSupplementDto {
  @ApiProperty({ description: '커스텀 영양제 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '영양제명', example: '비타민D' })
  name: string;

  @ApiProperty({ description: '용량/함량', example: '1000IU' })
  dosage?: string;

  @ApiProperty({ description: '메모', example: '아침 식후 복용' })
  memo?: string;

  @ApiProperty({ description: '생성일시', example: '2025-09-18T09:00:00Z' })
  createdAt: string;
}

/**
 * 간헐적 단식 기록 DTO
 * 공복 시작/종료 시간 기록
 */
export class CreateFastingRecordDto {
  @ApiProperty({ description: '공복 시작 시간', example: '20:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: '공복 종료 시간', example: '12:00' })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2024-01-15',
    required: false
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

/**
 * 수면 기록 DTO
 * 잠든 시간과 기상 시간 기록
 */
export class CreateSleepRecordDto {
  @ApiProperty({ description: '잠든 시간', example: '23:30' })
  @IsString()
  bedTime: string;

  @ApiProperty({ description: '기상 시간', example: '07:00' })
  @IsString()
  wakeTime: string;

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2024-01-15',
    required: false
  })
  @IsOptional()
  @IsDateString()
  date?: string;
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

  @ApiProperty({ description: '칼로리 계수 (시간당)', example: 150 })
  @IsNumber()
  calorie_rate: number;
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
      calorie_rate: 150
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

  @ApiProperty({
    description: '기록 날짜 (YYYY-MM-DD 형식)',
    example: '2025-09-15',
    required: false
  })
  @IsOptional()
  @IsDateString()
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