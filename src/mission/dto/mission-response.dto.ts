import { ApiProperty } from '@nestjs/swagger';
import { SpecialContentItem } from '../../common/types/special-content.types';

/**
 * 미션 정보 응답 DTO
 */
export class MissionResponseDto {
  @ApiProperty({
    description: '미션 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '미션 코드',
    example: 'QUIZ',
  })
  code: string;

  @ApiProperty({
    description: '미션 이름',
    example: '건강 퀴즈',
  })
  name: string;

  @ApiProperty({
    description: '미션 설명',
    example: '매일 제공되는 건강 관련 퀴즈를 풀어보세요',
  })
  description: string;

  @ApiProperty({
    description: '완료 시 획득 포인트',
    example: 20,
  })
  points: number;

  @ApiProperty({
    description: '업로드 필요 여부',
    example: false,
  })
  requireUpload: boolean;

  @ApiProperty({
    description: '업로드 타입',
    example: 'PHOTO',
    required: false,
  })
  uploadType?: string;

  @ApiProperty({
    description: '표시 순서',
    example: 1,
  })
  sortOrder: number;

  @ApiProperty({
    description: '미션 이미지 URL (특별 미션인 경우)',
    example: 'https://example.com/mission-image.jpg',
    required: false,
  })
  imageUrl?: string;

  @ApiProperty({
    description: '특별 미션 일차 (DAILY_MISSION인 경우)',
    example: 1,
    required: false,
  })
  specialMissionDay?: number;

  @ApiProperty({
    description: '검증 타입 (DAILY_MISSION인 경우)',
    example: 'PHOTO',
    required: false,
  })
  verifyType?: string;

  @ApiProperty({
    description: '수행 이유 (특별 미션인 경우)',
    example: '매일 새로운 건강 습관을 실천하며 도전 의식을 기릅니다',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: '수행 방법 (특별 미션인 경우)',
    example: '1. 거울 앞에 서서 자신을 바라봅니다\n2. 오늘 하루 감사한 점을 떠올립니다\n3. 자신에게 격려의 말을 건넵니다',
    required: false,
  })
  method?: string;

  @ApiProperty({
    description: '퀴즈 질문 (QUIZ 타입인 경우)',
    example: '퀴즈1: 하루에 권장되는 물 섭취량은?',
    required: false,
  })
  quizQuestion?: string;

  @ApiProperty({
    description: '퀴즈 선택지 (QUIZ 타입인 경우)',
    example: [
      { value: 1, label: '500ml' },
      { value: 2, label: '1L' },
      { value: 3, label: '2L' },
      { value: 4, label: '3L' }
    ],
    required: false,
    type: 'array',
    items: { type: 'object' },
  })
  quizOptions?: any[];

  @ApiProperty({
    description: '컨텐츠 타입 (DAILY_CONTENT인 경우)',
    example: 'VIDEO',
    required: false,
  })
  contentType?: string;

  @ApiProperty({
    description: '컨텐츠 URL (DAILY_CONTENT인 경우)',
    example: 'https://example.com/video1',
    required: false,
  })
  contentUrl?: string;

  @ApiProperty({
    description: '썸네일 URL (DAILY_CONTENT인 경우)',
    example: 'https://example.com/thumb1.jpg',
    required: false,
  })
  thumbnailUrl?: string;

  @ApiProperty({
    description: '상품 정보 배열 (DAILY_CONTENT인 경우)',
    example: [
      {
        itemUrl: 'https://example.com/product1',
        itemName: '비타민 D 보충제',
        itemDescription: '하루 1정으로 비타민 D 부족을 해결',
        itemImageUrl: 'https://example.com/product1-image.jpg',
        remarks: '아침 공복에 섭취 권장'
      },
      {
        itemUrl: 'https://example.com/product2',
        itemName: '오메가3',
        itemDescription: '혈행 개선에 도움',
        itemImageUrl: 'https://example.com/product2-image.jpg',
        remarks: null
      }
    ],
    required: false,
    type: 'array',
    items: { type: 'object' },
  })
  items?: SpecialContentItem[];

  @ApiProperty({
    description: '컨텐츠 일차 (DAILY_CONTENT인 경우)',
    example: 1,
    required: false,
  })
  contentDay?: number;
}

/**
 * 미션 진행 상황 DTO
 */
export class MissionProgressDto {
  @ApiProperty({
    description: '미션 정보',
    type: MissionResponseDto,
  })
  mission: MissionResponseDto;

  @ApiProperty({
    description: '완료 여부',
    example: true,
  })
  completed: boolean;

  @ApiProperty({
    description: '완료 시간',
    example: '2024-01-13T10:30:00.000Z',
    nullable: true,
  })
  completedAt: Date | null;

  @ApiProperty({
    description: '획득한 포인트',
    example: 20,
  })
  earnedPoints: number;

  @ApiProperty({
    description: '현재 완료 횟수 (하루 여러 번 가능한 미션)',
    example: 1,
    required: false,
  })
  currentCount?: number;

  @ApiProperty({
    description: '일일 최대 횟수 (하루 여러 번 가능한 미션)',
    example: 3,
    required: false,
  })
  maxCount?: number;
}

/**
 * 미션 진행 요약 DTO
 */
export class MissionSummaryDto {
  @ApiProperty({
    description: '전체 미션 수',
    example: 6,
  })
  totalMissions: number;

  @ApiProperty({
    description: '완료한 미션 수',
    example: 3,
  })
  completedMissions: number;

  @ApiProperty({
    description: '남은 미션 수',
    example: 3,
  })
  remainingMissions: number;

  @ApiProperty({
    description: '획득한 총 포인트',
    example: 60,
  })
  totalEarnedPoints: number;

  @ApiProperty({
    description: '획득 가능한 총 포인트',
    example: 150,
  })
  totalPossiblePoints: number;

  @ApiProperty({
    description: '완료율 (%)',
    example: 50,
  })
  completionRate: number;

  @ApiProperty({
    description: '전체 미션 수 (total_days 합계)',
    example: 417,
  })
  totalMissionCount: number;

  @ApiProperty({
    description: '수행한 전체 미션 수',
    example: 125,
  })
  completedMissionCount: number;

  @ApiProperty({
    description: '전체 이행률 (%) - 정수',
    example: 30,
  })
  overallCompletionRate: number;
}

/**
 * 사용자 미션 진행 상황 응답 DTO
 */
export class UserMissionProgressDto {
  @ApiProperty({
    description: '조회 날짜',
    example: '2024-01-13',
  })
  date: string;

  @ApiProperty({
    description: '미션별 진행 상황',
    type: [MissionProgressDto],
  })
  missions: MissionProgressDto[];

  @ApiProperty({
    description: '진행 요약',
    type: MissionSummaryDto,
  })
  summary: MissionSummaryDto;
}