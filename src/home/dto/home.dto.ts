import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { YesNo } from '../../common/enums';
import { UserSubscriptionStatus } from '../../common/enums/user-subscription-status.enum';

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
 * 홈 배너 링크 타입
 */
export enum HomeBannerLinkType {
  /** 내부 페이지 이동 */
  INTERNAL = 'INTERNAL',
  /** 외부 URL */
  EXTERNAL = 'EXTERNAL',
}

/**
 * 홈 배너 콘텐츠 타입 (linkType이 INTERNAL일 때 사용)
 */
export enum HomeBannerContentType {
  /** 챌린지 소개 페이지 */
  CHALLENGE_INTRO = 'CHALLENGE_INTRO',
  /** 강의 상세 */
  LECTURE = 'LECTURE',
  /** 칼럼 상세 */
  COLUMN = 'COLUMN',
  /** 상품 상세 */
  PRODUCT = 'PRODUCT',
}

/**
 * 퀴즈 상태 DTO (강의 배너용)
 * - alreadyCompleted만 제공, 나머지 상태는 프론트에서 currentDay와 dayNumber로 계산
 */
export class QuizStatusDto {
  @ApiProperty({ description: '이미 풀었는지 여부', example: false })
  alreadyCompleted: boolean;
}

/**
 * 배너 정보 DTO
 */
export class BannerInfoDto {
  @ApiProperty({ description: '배너 제목', example: '배빵펭귄에게 꼭 필요한' })
  title: string;

  @ApiPropertyOptional({ description: '배너 설명 (상품명 또는 콘텐츠 제목)', example: '세포 보호 바이오 밸런스' })
  description?: string;

  @ApiProperty({ description: '배너 이미지 URL', example: 'https://...' })
  imageUrl: string;

  @ApiProperty({
    description: '링크 타입 (INTERNAL: 앱 내부, EXTERNAL: 외부 URL)',
    example: 'INTERNAL',
    enum: HomeBannerLinkType,
  })
  linkType: HomeBannerLinkType;

  @ApiProperty({
    description: '콘텐츠 타입 (CHALLENGE_INTRO, LECTURE, COLUMN, PRODUCT)',
    example: 'CHALLENGE_INTRO',
    enum: HomeBannerContentType,
  })
  contentType: HomeBannerContentType;

  @ApiPropertyOptional({ description: '이동 대상 ID (콘텐츠ID, 상품ID 등)', example: 123 })
  targetId?: number | null;

  @ApiPropertyOptional({ description: '외부 URL (linkType이 EXTERNAL일 때)', example: 'https://example.com' })
  externalUrl?: string | null;

  @ApiPropertyOptional({ description: '퀴즈 상태 (강의 배너일 때만)' })
  quizStatus?: QuizStatusDto | null;
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

  @ApiPropertyOptional({ description: '일일 최대 포인트 지급 횟수 (null이면 무제한)', example: 3 })
  max: number | null;

  @ApiProperty({ description: '오늘 포인트 지급 횟수', example: 0 })
  current: number;

  @ApiProperty({ description: '오늘 실행 횟수', example: 0 })
  executed: number;

  @ApiProperty({ description: '기록유형', example: 'DIET' })
  recordType: string;

  @ApiProperty({ description: '정렬순서', example: 1 })
  sortOrder: number;

  @ApiPropertyOptional({ description: '비활성화 여부 (뉴커머)', example: false })
  disabled?: boolean;
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
}

/**
 * 홈 화면 응답 DTO
 */
export class HomeResponseDto {
  @ApiProperty({
    description: '사용자 타입',
    enum: UserSubscriptionStatus,
    example: UserSubscriptionStatus.NEWCOMER,
  })
  userType: UserSubscriptionStatus;

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

  @ApiPropertyOptional({ description: '챌린지 시작일 (상태 무관, 없으면 null)', example: '2025-01-01' })
  startDate: string | null;

  @ApiPropertyOptional({ description: '챌린지 종료일 (상태 무관, 없으면 null)', example: '2025-01-21' })
  endDate: string | null;

  @ApiProperty({ description: '오늘의 미션 목록 (챌린지 없어도 목업 데이터 제공)', type: [MissionItemDto] })
  missionList: MissionItemDto[];

  @ApiProperty({ description: '뉴커머 첫 방문 여부 (구매 이력 없음 + 결과지 없음 상태에서 최초 1회)', example: true })
  isFirstVisitAsNewcomer: boolean;

  @ApiProperty({ description: '챌린지 시작 후 첫 방문 여부 (ACTIVE 전환 후 최초 1회)', example: false })
  isFirstVisitAfterChallengeStart: boolean;

  @ApiProperty({ description: '챌린지 종료 후 첫 방문 여부 (COMPLETED 후 최초 1회)', example: false })
  isFirstVisitAfterChallengeEnd: boolean;

  @ApiProperty({ description: '챌린지 이력이 있는 뉴커머 여부 (과거 챌린지 완료했으나 현재 진행 중인 챌린지 없음)', example: false })
  hasCompletedChallengeHistory: boolean;

  @ApiProperty({ description: '사후문진 완료 여부 (가장 최근 완료된 챌린지 기준)', example: false })
  hasAfterSurvey: boolean;

  @ApiProperty({ description: '챌린지 종료 후 일주일 이내 여부 (가장 최근 완료된 챌린지 기준)', example: false })
  isWithinOneWeekAfterEnd: boolean;
}

