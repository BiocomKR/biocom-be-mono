import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 챌린지 활성화 DTO
 */
export class ActivateChallengeDto {
  @ApiProperty({
    description: '활성화할 챌린지 수행권 ID',
    example: 1
  })
  @IsNotEmpty({ message: '수행권 ID는 필수입니다' })
  @IsNumber({}, { message: '수행권 ID는 숫자여야 합니다' })
  ticketId: number;
}

/**
 * 챌린지 기본 정보 응답 DTO
 */
export class ChallengeResponseDto {
  @ApiProperty({
    description: '챌린지 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '챌린지 이름',
    example: '21일 건강 챌린지'
  })
  name: string;

  @ApiProperty({
    description: '챌린지 설명',
    example: '21일 동안 건강한 습관을 만들어보세요',
    required: false
  })
  description?: string;

  @ApiProperty({
    description: '총 진행 일수',
    example: 21
  })
  totalDays: number;

  @ApiProperty({
    description: '활성화 여부',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: '관련 상품 정보',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: '21일 건강 챌린지 키트' },
        price: { type: 'number', example: 89000 }
      }
    }
  })
  products: Array<{
    id: number;
    name: string;
    price: number;
  }>;
}

/**
 * 챌린지 수행권 응답 DTO
 */
export class ChallengeTicketResponseDto {
  @ApiProperty({
    description: '수행권 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '챌린지 정보',
    type: ChallengeResponseDto
  })
  challenge: ChallengeResponseDto;

  @ApiProperty({
    description: '구매일',
    example: '2024-08-29T00:00:00Z'
  })
  purchaseDate: Date;

  @ApiProperty({
    description: '상태',
    enum: ['PURCHASED', 'ACTIVATED', 'COMPLETED', 'EXPIRED'],
    example: 'PURCHASED'
  })
  status: string;
}

/**
 * 활성 챌린지 응답 DTO
 */
export class ActiveChallengeResponseDto {
  @ApiProperty({
    description: '사용자 챌린지 ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: '챌린지 정보',
    type: ChallengeResponseDto
  })
  challenge: ChallengeResponseDto;

  @ApiProperty({
    description: '활성화 일시',
    example: '2024-08-29T00:00:00Z'
  })
  activatedAt: Date;

  @ApiProperty({
    description: '종료 예정일',
    example: '2024-09-18T23:59:59Z'
  })
  expiresAt: Date;

  @ApiProperty({
    description: '현재 진행 일차',
    example: 5
  })
  currentDay: number;

  @ApiProperty({
    description: '총 획득 포인트',
    example: 1200
  })
  totalPoints: number;

  @ApiProperty({
    description: '상태',
    enum: ['ACTIVE', 'COMPLETED', 'EXPIRED'],
    example: 'ACTIVE'
  })
  status: string;
}

/**
 * 일별 진행 상황 DTO
 */
export class DailyProgressDto {
  @ApiProperty({
    description: '일차',
    example: 5
  })
  day: number;

  @ApiProperty({
    description: '날짜',
    example: '2024-09-02'
  })
  date: Date;

  @ApiProperty({
    description: '미션 진행률',
    type: 'object',
    properties: {
      total: { type: 'number', example: 3 },
      completed: { type: 'number', example: 2 }
    }
  })
  missions: {
    total: number;
    completed: number;
  };

  @ApiProperty({
    description: '설문 진행률',
    type: 'object',
    properties: {
      total: { type: 'number', example: 1 },
      completed: { type: 'number', example: 1 }
    }
  })
  surveys: {
    total: number;
    completed: number;
  };

  @ApiProperty({
    description: '퀴즈 진행률',
    type: 'object',
    properties: {
      total: { type: 'number', example: 1 },
      correct: { type: 'number', example: 1 }
    }
  })
  quizzes: {
    total: number;
    correct: number;
  };

  @ApiProperty({
    description: '컨텐츠 진행률',
    type: 'object',
    properties: {
      total: { type: 'number', example: 2 },
      viewed: { type: 'number', example: 1 }
    }
  })
  contents: {
    total: number;
    viewed: number;
  };

  @ApiProperty({
    description: '기록 진행률',
    type: 'object',
    properties: {
      total: { type: 'number', example: 7 },
      completed: { type: 'number', example: 5 }
    }
  })
  trackings: {
    total: number;
    completed: number;
  };

  @ApiProperty({
    description: '획득 포인트',
    example: 300
  })
  pointsEarned: number;
}

/**
 * 오늘의 활동 응답 DTO
 */
export class TodayActivitiesDto {
  @ApiProperty({
    description: '현재 일차',
    example: 5
  })
  currentDay: number;

  @ApiProperty({
    description: '오늘 날짜',
    example: '2024-09-02'
  })
  todayDate: Date;

  @ApiProperty({
    description: '오늘의 미션 목록'
  })
  missions: Array<any>;

  @ApiProperty({
    description: '오늘의 설문 목록'
  })
  surveys: Array<any>;

  @ApiProperty({
    description: '오늘의 퀴즈 목록'
  })
  quizzes: Array<any>;

  @ApiProperty({
    description: '이번 주 컨텐츠 목록'
  })
  contents: Array<any>;

  @ApiProperty({
    description: '오늘의 기록 항목 목록'
  })
  trackings: Array<any>;
}