import { ApiProperty } from '@nestjs/swagger';

/**
 * 기록 유형별 개수
 */
export class RecordsByTypeDto {
  @ApiProperty({ description: '이너뷰티 기록 수' })
  BEAUTY: number;

  @ApiProperty({ description: '식단 기록 수' })
  DIET: number;

  @ApiProperty({ description: '영양제 기록 수' })
  SUPPLEMENT: number;

  @ApiProperty({ description: '단식 기록 수' })
  FASTING: number;

  @ApiProperty({ description: '수면 기록 수' })
  SLEEP: number;

  @ApiProperty({ description: '활동 기록 수' })
  ACTIVITY: number;
}

/**
 * 일별 트렌드 데이터
 */
export class DailyTrendDto {
  @ApiProperty({ description: '날짜 (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: '기록 수' })
  records: number;

  @ApiProperty({ description: '기록한 사용자 수' })
  users: number;
}

/**
 * 기록 유형별 참여율
 */
export class TypeParticipationDto {
  @ApiProperty({ description: '기록 유형 코드' })
  type: string;

  @ApiProperty({ description: '기록 유형 라벨' })
  label: string;

  @ApiProperty({ description: '기록 수' })
  count: number;

  @ApiProperty({ description: '참여율 (%)' })
  percentage: number;
}

/**
 * 리텐션 지표
 */
export class RetentionDto {
  @ApiProperty({ description: 'DAU (일간 활성 사용자)' })
  dau: number;

  @ApiProperty({ description: 'WAU (주간 활성 사용자)' })
  wau: number;

  @ApiProperty({ description: 'MAU (월간 활성 사용자)' })
  mau: number;

  @ApiProperty({ description: 'DAU/MAU 비율 (스티키니스, %)' })
  stickiness: number;

  @ApiProperty({ description: '7일 리텐션율 (%)' })
  retention7d: number;

  @ApiProperty({ description: '30일 리텐션율 (%)' })
  retention30d: number;
}

/**
 * 참여도 지표
 */
export class EngagementDto {
  @ApiProperty({ description: '인당 평균 기록 수 (이번 주)' })
  avgRecordsPerUser: number;

  @ApiProperty({ description: '평균 연속 기록 일수' })
  avgStreakDays: number;

  @ApiProperty({ description: '최대 연속 기록 일수' })
  maxStreakDays: number;

  @ApiProperty({ description: '7일 연속 기록 달성자 수' })
  streak7dUsers: number;
}

/**
 * 이탈 위험 지표
 */
export class ChurnRiskDto {
  @ApiProperty({ description: '3일 이상 미기록 사용자 수' })
  inactive3d: number;

  @ApiProperty({ description: '7일 이상 미기록 사용자 수' })
  inactive7d: number;

  @ApiProperty({ description: '이탈 위험률 (%)' })
  churnRiskRate: number;
}

/**
 * 성장 지표
 */
export class GrowthDto {
  @ApiProperty({ description: '이번 주 신규 가입자 수' })
  newUsersThisWeek: number;

  @ApiProperty({ description: '신규 가입자 첫 기록 전환율 (%)' })
  firstRecordConversionRate: number;

  @ApiProperty({ description: '전주 대비 DAU 증감률 (%)' })
  dauGrowthRate: number;
}

/**
 * 기록 유형별 습관화 지표
 */
export class TypeHabitDto {
  @ApiProperty({ description: '기록 유형' })
  type: string;

  @ApiProperty({ description: '기록 유형 라벨' })
  label: string;

  @ApiProperty({ description: '주 3회 이상 기록 사용자 비율 (%)' })
  habitRate: number;

  @ApiProperty({ description: '이 유형 기록 사용자 수' })
  userCount: number;
}

/**
 * 일차별 기록율 데이터
 */
export class DayRecordRateDto {
  @ApiProperty({ description: '일차 (1~21)' })
  day: number;

  @ApiProperty({ description: '해당 일차 도달 사용자 수' })
  totalUsers: number;

  @ApiProperty({ description: '기록한 사용자 수' })
  recordedUsers: number;

  @ApiProperty({ description: '기록율 (%)' })
  recordRate: number;
}

/**
 * 주차별 완료율 데이터
 */
export class WeekCompletionDto {
  @ApiProperty({ description: '주차 (1~3)' })
  week: number;

  @ApiProperty({ description: '해당 주차 시작 사용자 수' })
  startUsers: number;

  @ApiProperty({ description: '해당 주차 완료 사용자 수' })
  completedUsers: number;

  @ApiProperty({ description: '완료율 (%)' })
  completionRate: number;

  @ApiProperty({ description: '이탈 사용자 수' })
  droppedUsers: number;
}

/**
 * 챌린지 분석 데이터
 */
export class ChallengeAnalysisDto {
  @ApiProperty({ description: '활성 챌린지 수' })
  activeChallenges: number;

  @ApiProperty({ description: '완료된 챌린지 수 (최근 30일)' })
  completedChallenges: number;

  @ApiProperty({ description: '완주율 (21일 완료 비율, %)' })
  completionRate: number;

  @ApiProperty({ description: '일차별 기록율 (1~21일)', type: [DayRecordRateDto] })
  dayRecordRates: DayRecordRateDto[];

  @ApiProperty({ description: '주차별 완료율 (1~3주차)', type: [WeekCompletionDto] })
  weekCompletions: WeekCompletionDto[];
}

/**
 * 챌린지 대시보드 응답 (경영진용)
 */
export class RecordsDashboardDto {
  @ApiProperty({ description: '리텐션 지표', type: RetentionDto })
  retention: RetentionDto;

  @ApiProperty({ description: '참여도 지표', type: EngagementDto })
  engagement: EngagementDto;

  @ApiProperty({ description: '이탈 위험 지표', type: ChurnRiskDto })
  churnRisk: ChurnRiskDto;

  @ApiProperty({ description: '성장 지표', type: GrowthDto })
  growth: GrowthDto;

  @ApiProperty({ description: '기록 유형별 습관화', type: [TypeHabitDto] })
  typeHabits: TypeHabitDto[];

  @ApiProperty({ description: '일별 DAU 트렌드 (최근 14일)', type: [DailyTrendDto] })
  dauTrend: DailyTrendDto[];

  @ApiProperty({ description: '챌린지 분석', type: ChallengeAnalysisDto })
  challengeAnalysis: ChallengeAnalysisDto;
}

/**
 * 기록 유형별 통계
 */
export class RecordTypeStatsDto {
  @ApiProperty({ description: '기록 유형' })
  type: string;

  @ApiProperty({ description: '기록 유형 라벨' })
  label: string;

  @ApiProperty({ description: '오늘 기록 수' })
  todayCount: number;

  @ApiProperty({ description: '이번 주 기록 수' })
  weekCount: number;

  @ApiProperty({ description: '이번 달 기록 수' })
  monthCount: number;

  @ApiProperty({ description: '전체 기록 수' })
  totalCount: number;

  @ApiProperty({ description: '오늘 기록 사용자 수' })
  todayUsers: number;

  @ApiProperty({ description: '이번 주 기록 사용자 수' })
  weekUsers: number;
}

/**
 * 기록통계 내역 응답 (운영용)
 */
export class RecordsStatsDto {
  @ApiProperty({ description: '전체 기록 수' })
  totalRecords: number;

  @ApiProperty({ description: '오늘 기록 수' })
  todayRecords: number;

  @ApiProperty({ description: '이번 주 기록 수' })
  weekRecords: number;

  @ApiProperty({ description: '이번 달 기록 수' })
  monthRecords: number;

  @ApiProperty({ description: '기록 유형별 통계', type: [RecordTypeStatsDto] })
  byType: RecordTypeStatsDto[];

  @ApiProperty({ description: '일별 트렌드 (최근 14일)', type: [DailyTrendDto] })
  dailyTrend: DailyTrendDto[];
}

/**
 * 사용자별 기록 요약
 */
export class UserRecordSummaryDto {
  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiProperty({ description: '이메일' })
  email: string;

  @ApiProperty({ description: '챌린지 상태' })
  challengeStatus: string | null;

  @ApiProperty({ description: '챌린지 일차' })
  challengeDay: number | null;

  @ApiProperty({ description: '전체 기록 수' })
  totalRecords: number;

  @ApiProperty({ description: '이번 주 기록 수' })
  weekRecords: number;

  @ApiProperty({ description: '최근 기록일' })
  lastRecordDate: string | null;

  @ApiProperty({ description: '연속 기록 일수' })
  streakDays: number;

  @ApiProperty({ description: '기록 유형별 수 (이번 주)' })
  byType: Record<string, number>;
}

/**
 * 사용자별 기록통계 목록 응답
 */
export class UserRecordStatsListDto {
  @ApiProperty({ description: '사용자별 기록 목록', type: [UserRecordSummaryDto] })
  users: UserRecordSummaryDto[];

  @ApiProperty({ description: '전체 수' })
  total: number;

  @ApiProperty({ description: '페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 수' })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;
}
