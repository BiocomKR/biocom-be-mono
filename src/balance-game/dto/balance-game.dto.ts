import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  Min
} from 'class-validator';

export enum StepType {
  QUESTION = 'QUESTION',
  DIALOGUE = 'DIALOGUE',
  RESULT = 'RESULT'
}


/**
 * 오늘의 밸런스게임 조회 응답 DTO
 */
export class TodayBalanceGameResponseDto {
  @ApiProperty({ description: '게임 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '게임 제목', example: '둘 중 하나만 가질 수 있다면?' })
  title: string;

  @ApiPropertyOptional({ description: '게임 설명' })
  description?: string;

  // @ApiPropertyOptional({ description: '대표 이미지 URL' })
  // thumbnailUrl?: string;

  // @ApiPropertyOptional({ description: '배경 이미지 URL' })
  // backgroundUrl?: string;

  @ApiPropertyOptional({ description: '페르소나 이미지 URL' })
  personaUrl?: string;

  @ApiPropertyOptional({ description: '페르소나 이름', example: '뽀로로' })
  personaName?: string;

  @ApiProperty({ description: '오늘 이미 플레이했는지 여부', example: false })
  hasPlayedToday: boolean;

  @ApiProperty({ description: '챌린지 진행일차 (1~21일차)', example: 5 })
  challengeDay: number;
}

/**
 * 밸런스게임 단계 응답 DTO
 */
export class BalanceGameStepResponseDto {
  @ApiProperty({ description: '단계 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '단계 번호', example: 1 })
  stepNumber: number;

  @ApiProperty({ description: '단계 타입', enum: StepType, example: StepType.QUESTION })
  stepType: StepType;

  @ApiPropertyOptional({ description: '제목' })
  title?: string;

  @ApiProperty({ description: '내용', example: '둘 중 하나만 가질 수 있다면 어떤걸 선택할래?' })
  content: string;

  @ApiPropertyOptional({
    description: '선택지 배열 (질문 단계인 경우)',
    example: [
      { value: 1, text: '장원영 얼굴' },
      { value: 2, text: '권은비 몸매' }
    ]
  })
  options?: Array<{ value: number; text: string }>;


  @ApiPropertyOptional({ description: '획득할 쿠폰 정보 (결과 단계인 경우)' })
  coupon?: {
    id: number;
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
    productName: string;
  };
}

/**
 * 밸런스게임 선택 요청 DTO
 */
export class BalanceGameChoiceDto {
  @ApiPropertyOptional({ description: '부모 단계 ID (2단계부터 필요)', example: 1 })
  @IsOptional()
  @IsNumber()
  parentStepId?: number;

  @ApiPropertyOptional({ description: '선택한 옵션 값 (2단계부터 필요)', example: 1, minimum: 1, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  selectedOption?: number;
}

/**
 * 밸런스게임 완료 응답 DTO
 */
export class BalanceGameCompleteResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '완료 메시지', example: '밸런스게임을 완료했습니다!' })
  message: string;


  @ApiPropertyOptional({ description: '획득한 쿠폰' })
  earnedCoupon?: {
    id: number;
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
    productName: string;
    expiresAt: string;
  };
}


/**
 * 밸런스게임 진행 상태 응답 DTO
 */
export class BalanceGameProgressResponseDto {
  @ApiProperty({ description: '게임 ID', example: 1 })
  gameId: number;

  @ApiProperty({ description: '현재 단계 정보' })
  step: BalanceGameStepResponseDto;
}