import { ApiProperty } from '@nestjs/swagger';

/**
 * 홈 화면 기본 데이터 DTO
 */
export class HomeDataDto {
  @ApiProperty({ description: '사용자 구독 상태', example: 'NEWCOMER' })
  subscriptionStatus: string;

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