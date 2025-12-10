import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { YesNo } from '../../common/enums';

/**
 * 검사 결과 정보 DTO (SIB API 연동)
 */
export class ReportInfoDto {
  @ApiPropertyOptional({ description: '차트 ID', example: 'BA2516182' })
  chartId: string | null;

  @ApiProperty({ description: '결과 여부', example: 'Y', enum: YesNo })
  resultYN: YesNo;

  @ApiPropertyOptional({ description: 'SIB API 오류 여부' })
  sibError?: boolean;
}

/**
 * 동물 유형 정보 DTO
 */
export class AnimalTypeDto {
  @ApiProperty({ description: '동물 유형 이름', example: '배 빵빵 펭귄' })
  name: string;

  @ApiProperty({ description: '동물 유형 설명', example: '장 건강에 주의가 필요한 타입' })
  description: string;

  @ApiProperty({ description: '동물 이미지 URL', example: 'https://...' })
  imageUrl: string;
}

/**
 * 페르소나 정보 DTO
 */
export class PersonaInfoDto {
  @ApiProperty({ description: '페르소나 이름', example: '철민님' })
  name: string;

  @ApiProperty({ description: '페르소나 이미지 URL', example: 'https://...' })
  imageUrl: string;
}

/**
 * 배너 정보 DTO
 */
export class BannerInfoDto {
  @ApiProperty({ description: '배너 제목', example: '오늘의 건강 팁' })
  title: string;

  @ApiPropertyOptional({ description: '배너 설명', example: '10살 어려지는 식단 비법' })
  description?: string;

  @ApiProperty({ description: '배너 이미지 URL', example: 'https://...' })
  imageUrl: string;

  @ApiPropertyOptional({ description: '클릭 시 이동 URL', example: '/content/1' })
  linkUrl: string | null;

  @ApiProperty({ description: '링크 타입', example: 'INTERNAL', enum: ['INTERNAL', 'EXTERNAL', 'PRODUCT'] })
  linkType: string;
}

/**
 * 미션 아이템 DTO
 */
export class MissionItemDto {
  @ApiProperty({ description: '미션 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '미션 제목', example: '아침 물 마시고' })
  title: string;

  @ApiProperty({ description: '미션 설명', example: '기상 후 물 500ml 마시기' })
  description: string;

  @ApiProperty({ description: '포인트', example: 100 })
  point: number;

  @ApiPropertyOptional({ description: '일일 최대 수행 횟수 (null이면 무제한)', example: 1 })
  max: number | null;

  @ApiProperty({ description: '오늘 수행한 횟수', example: 0 })
  current: number;

  @ApiProperty({ description: '기록유형', example: 'DIET' })
  recordType: string;

  @ApiProperty({ description: '정렬순서', example: 1 })
  sortOrder: number;
}

/**
 * 챌린지 정보 DTO
 */
export class ChallengeInfoDto {
  @ApiProperty({ description: '챌린지 코드 (상품 SKU)', example: 'CHALLENGE_21' })
  challengeCode: string;

  @ApiProperty({ description: '챌린지 시작일', example: '2025-01-01' })
  startDate: string;

  @ApiProperty({ description: '챌린지 종료일', example: '2025-01-21' })
  endDate: string;

  @ApiProperty({ description: '현재 챌린지 일차', example: 5 })
  currentDay: number;

  @ApiProperty({ description: '챌린지 진행률 (%)', example: 35 })
  challengePercent: number;

  @ApiProperty({ description: '챌린지 홈 최초 진입 여부', example: true })
  isFirstEntry: boolean;
}

/**
 * 홈 화면 응답 DTO (새 스펙)
 */
export class NewHomeResponseDto {
  @ApiProperty({ description: '검사 결과 정보 (지연성 알러지)' })
  reportInfo: ReportInfoDto;

  @ApiPropertyOptional({ description: '동물 유형 (사전문진 resultYN=Y일 때만)' })
  animalType: AnimalTypeDto | null;

  @ApiPropertyOptional({ description: '페르소나 정보' })
  persona: PersonaInfoDto | null;

  @ApiProperty({ description: '사용자 포인트', example: 1500 })
  userPoint: number;

  @ApiProperty({ description: '배너 정보' })
  banner: BannerInfoDto;

  @ApiPropertyOptional({ description: '챌린지 정보 (CHALLENGER만)' })
  challengeInfo: ChallengeInfoDto | null;

  @ApiProperty({ description: '오늘의 미션 목록 (챌린지 없어도 목업 데이터 제공)', type: [MissionItemDto] })
  missionList: MissionItemDto[];
}

// ============================================
// 기존 DTO (하위 호환성 유지)
// ============================================

/**
 * 홈 화면 기본 데이터 DTO
 */
export class HomeDataDto {
  @ApiProperty({ description: '사용자 구독 상태', example: 'NEWCOMER' })
  status: string;

  @ApiProperty({ description: '사용자 이름', example: '홍길동' })
  userName: string;

  @ApiProperty({ description: '홈 화면 타입', example: 'newcomer' })
  homeType: 'newcomer' | 'challenger' | 'subscriber';

  @ApiProperty({ description: '환영 메시지', example: '안녕하세요, 홍길동님!' })
  welcomeMessage: string;
}

/**
 * 신규 사용자(NEWCOMER) 홈 화면 데이터 DTO
 */
export class NewcomerHomeDataDto extends HomeDataDto {
  @ApiProperty({ description: '챌린지 상품 정보' })
  challengeProduct: {
    id: number;
    name: string;
    price: number;
    description: string;
    imageUrl?: string;
  };

  @ApiProperty({ description: '종합건강대사 검사 완료 여부', example: true })
  healthExamCompleted: boolean;

  @ApiProperty({ description: '챌린지 구매 가능 여부', example: true })
  canPurchaseChallenge: boolean;

  @ApiProperty({ description: '안내 메시지', example: '21일 챌린지로 건강한 변화를 시작해보세요!' })
  guideMessage: string;
}

/**
 * 챌린저(CHALLENGER) 홈 화면 데이터 DTO
 */
export class ChallengerHomeDataDto extends HomeDataDto {
  @ApiProperty({ description: '현재 진행 중인 챌린지 정보' })
  currentChallenge: {
    id: number;
    challengeType: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    progress: number; // 0-100 퍼센트
  };

  @ApiProperty({ description: '오늘의 미션 목록' })
  todayMissions: Array<{
    id: number;
    title: string;
    description: string;
    isCompleted: boolean;
    type: string;
  }>;

  @ApiProperty({ description: '주간 통계 요약' })
  weeklyStats: {
    recordsThisWeek: number;
    completedMissions: number;
    totalMissions: number;
  };
}

/**
 * 구독자(SUBSCRIBER) 홈 화면 데이터 DTO
 */
export class SubscriberHomeDataDto extends HomeDataDto {
  @ApiProperty({ description: '구독 정보' })
  subscription: {
    plan: string;
    startDate: string;
    nextBillingDate: string;
    status: string;
  };

  @ApiProperty({ description: '최근 기록 요약' })
  recentRecords: {
    beauty: number;
    diet: number;
    supplement: number;
    fasting: number;
    sleep: number;
    activity: number;
  };

  @ApiProperty({ description: '추천 컨텐츠' })
  recommendedContent: Array<{
    id: number;
    title: string;
    type: string;
    thumbnailUrl?: string;
  }>;
}

/**
 * 홈 화면 응답 DTO (Union Type)
 */
export class HomeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    description: '홈 화면 데이터 (사용자 상태에 따라 다른 구조)',
    oneOf: [
      { $ref: '#/components/schemas/NewcomerHomeDataDto' },
      { $ref: '#/components/schemas/ChallengerHomeDataDto' },
      { $ref: '#/components/schemas/SubscriberHomeDataDto' },
    ],
  })
  data: NewcomerHomeDataDto | ChallengerHomeDataDto | SubscriberHomeDataDto;

  @ApiProperty({ example: '홈 화면 데이터 조회 성공' })
  message: string;
}
