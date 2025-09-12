import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsDateString, ValidateNested, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 이너뷰티 기록 DTO
 * 설문식 5점 척도 × 5개 질문
 */
export class CreateBeautyRecordDto {
  @ApiProperty({
    description: '5가지 이너뷰티 질문에 대한 5점 척도 응답',
    example: {
      question1: 4,
      question2: 3,
      question3: 5,
      question4: 2,
      question5: 4
    }
  })
  @IsNotEmpty()
  responses: {
    question1: number; // 1-5점
    question2: number;
    question3: number;
    question4: number;
    question5: number;
  };

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
 * 식단 기록 DTO
 * 아침/점심/저녁별 섭취 식품 기록
 */
export class MealRecordDto {
  @ApiProperty({ description: '식사 시간', example: '08:30' })
  @IsString()
  time: string;

  @ApiProperty({ 
    description: '섭취한 식품 목록', 
    example: ['현미밥', '김치', '된장국', '계란후라이'] 
  })
  @IsArray()
  @IsString({ each: true })
  foods: string[];
}

export class CreateDietRecordDto {
  @ApiProperty({ description: '아침 식사 기록', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealRecordDto)
  breakfast?: MealRecordDto;

  @ApiProperty({ description: '점심 식사 기록', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealRecordDto)
  lunch?: MealRecordDto;

  @ApiProperty({ description: '저녁 식사 기록', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealRecordDto)
  dinner?: MealRecordDto;

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
 * 영양제 섭취 기록 DTO
 * 개인 영양제 목록과 섭취 시간 기록
 */
export class SupplementItemDto {
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

export class CreateSupplementRecordDto {
  @ApiProperty({ description: '섭취 시간 설정', example: '09:00' })
  @IsString()
  time: string;

  @ApiProperty({
    description: '영양제 목록',
    type: [SupplementItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplementItemDto)
  supplements: SupplementItemDto[];

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
 * 활동 기록 DTO
 * 운동 종목과 시간 기록
 */
export class ActivityItemDto {
  @ApiProperty({ description: '운동 종목 코드', example: 'WALKING' })
  @IsString()
  exerciseCode: string;

  @ApiProperty({ description: '운동 시간(분)', example: 30 })
  @IsNumber()
  @Min(1)
  duration: number;
}

export class CreateActivityRecordDto {
  @ApiProperty({
    description: '활동 목록',
    type: [ActivityItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityItemDto)
  activities: ActivityItemDto[];

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