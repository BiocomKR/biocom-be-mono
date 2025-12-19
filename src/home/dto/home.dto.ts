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
}

