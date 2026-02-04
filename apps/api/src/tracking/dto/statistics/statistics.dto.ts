import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

/**
 * 통계 기간 타입
 * 현재는 1주일 고정이지만, 추후 확장 가능하도록 주석 처리
 */
export type StatisticsPeriod = '1week'; 
// TODO: 기획 변경 시 '1day' | '1month' 추가 예정

/**
 * 일별 데이터 인터페이스
 */
export interface DailyData {
  date: string; // YYYY-MM-DD 형식
  value: number;
  hasRecord: boolean; // 해당 날짜에 기록이 있는지 여부
  achievementRate?: number; // 기준 대비 달성률 (%) - 활동 통계에서 사용
}

/**
 * 달성률 정보
 */
export interface AchievementInfo {
  achievedDays: number; // 목표 달성 일수
  totalDays: number;    // 전체 일수 (7일)
  percentage: number;   // 달성률 (소수점 반올림)
}

// ========================================
// 🌸 이너뷰티 통계 DTO (형님 정확한 데이터셋 기준)
// ========================================

/**
 * 일별 점수 데이터 인터페이스
 */
export interface DailyScore {
  date: string;
  value: string;
}

/**
 * 답변별 점수 인터페이스
 */
export interface AnswerScore {
  no: number;
  score: number;
}

/**
 * 요약 데이터 인터페이스
 */
export interface BeautySummary {
  score: number; // 주간 이너뷰티,아우터뷰티의 평균값의 합
  weekScore: DailyScore[]; // 지난7일의 일자별 이너뷰티,아우터뷰티의 평균값
}

/**
 * 이너뷰티 세부 데이터 인터페이스
 */
export interface InnerBeautyDetail {
  score: number; // 주간 이너뷰티점수의 평균값
  weekScore: DailyScore[]; // 지난7일의 일자별 이너뷰티의 평균값
  answer: AnswerScore[]; // 질문별 평균 점수
}

/**
 * 아우터뷰티 세부 데이터 인터페이스
 */
export interface OuterBeautyDetail {
  score: number; // 주간 아우터뷰티점수의 평균값
  weekScore: DailyScore[]; // 지난7일의 일자별 아우터뷰티의 평균값
  answer: AnswerScore[]; // 질문별 평균 점수
}

/**
 * 세부 데이터 인터페이스
 */
export interface BeautyDetailData {
  innerBeauty: InnerBeautyDetail;
  outerBeauty: OuterBeautyDetail;
}

/**
 * 이너뷰티 통계 응답 DTO (형님 정확한 데이터셋)
 */
export class BeautyStatisticsDto {
  @ApiProperty({
    description: '요약 데이터',
    example: {
      score: 50,
      weekScore: [
        { date: "2025-09-09", value: "30" },
        { date: "2025-09-10", value: "40" }
      ],
      comment: "하드코딩 멘트"
    }
  })
  summary: BeautySummary;

  @ApiProperty({
    description: '세부 데이터',
    example: {
      innerBeauty: {
        score: 20,
        weekScore: [
          { date: "2025-09-09", value: "30" }
        ],
        answer: [
          { no: 1, score: 15 },
          { no: 2, score: 35 }
        ]
      },
      outerBeauty: {
        score: 40,
        weekScore: [
          { date: "2025-09-09", value: "20" }
        ],
        answer: [
          { no: 1, score: 15 }
        ]
      },
      totalComment: "하드코딩 멘트"
    }
  })
  detailData: BeautyDetailData;

  @ApiProperty({ description: '현재 기록 수', example: 5 })
  currentCount: number;

  @ApiProperty({ description: '최대 기록 수 (1일 1회)', example: 1 })
  maxCount: number;
}

// ========================================  
// 🍽️ 식단 통계 DTO
// ========================================

/**
 * 식단 카테고리별 점수 DTO
 */
export class DietCategoryScoreDto {
  @ApiProperty({ description: '카테고리 점수', example: 26 })
  score: number;

  @ApiProperty({
    description: '일별 점수 배열',
    example: [
      { date: '2025-09-10', value: '8' },
      { date: '2025-09-11', value: '4' },
      { date: '2025-09-12', value: '1' },
      { date: '2025-09-13', value: '6' },
      { date: '2025-09-14', value: '4' },
      { date: '2025-09-15', value: '3' },
      { date: '2025-09-16', value: '0' }
    ]
  })
  weekScore: { date: string; value: string }[];
}

/**
 * 식단 통계 상세 데이터 DTO
 */
export class DietDetailDataDto {
  @ApiProperty({ description: '과민식품 통계', type: DietCategoryScoreDto })
  allergyFoods: DietCategoryScoreDto;

  @ApiProperty({ description: '고포드맵식품 통계', type: DietCategoryScoreDto })
  highFodmapFoods: DietCategoryScoreDto;

  @ApiProperty({ description: '건강식품 통계', type: DietCategoryScoreDto })
  healthFoods?: DietCategoryScoreDto;

  @ApiProperty({ description: '가공식품 통계', type: DietCategoryScoreDto })
  processedFoods: DietCategoryScoreDto;
}

/**
 * 식단 통계 요약 DTO
 */
export class DietSummaryDto {
  @ApiProperty({ description: '요약 점수', example: 15 })
  score: number;
}

/**
 * 식단 통계 응답 DTO (새로운 구조)
 */
export class DietStatisticsDto {
  @ApiProperty({ description: '통계 요약', type: DietSummaryDto })
  summary: DietSummaryDto;

  @ApiProperty({ description: '상세 데이터', type: DietDetailDataDto })
  detailData: DietDetailDataDto;

  @ApiProperty({ description: '현재 기록 수', example: 18 })
  currentCount: number;

  @ApiProperty({ description: '최대 기록 수 (1일 9회: 아침1+점심1+저녁1+간식3+야식3)', example: 9 })
  maxCount: number;
}

// ========================================
// 💊 영양제 통계 DTO  
// ========================================

/**
 * 일별 영양제 섭취 데이터 DTO
 */
/**
 * 일별 영양제 섭취 상태 DTO
 */
export class DailySupplementStatusDto {
  @ApiProperty({
    description: '날짜 (YYYY-MM-DD)',
    example: '2025-07-20'
  })
  date: string;

  @ApiProperty({
    description: '섭취량 (null = 해당 날짜 루틴에 없음)',
    example: 1,
    nullable: true
  })
  intakeCount: number | null;

  @ApiProperty({
    description: '권장 섭취량 (null = 해당 날짜 루틴에 없음)',
    example: 2,
    nullable: true
  })
  recommendedCount: number | null;
}

/**
 * 영양제별 주간 통계 DTO
 */
export class SupplementWeeklyStatsDto {
  @ApiProperty({
    description: '영양제 ID',
    example: 4
  })
  productId: number;

  @ApiProperty({
    description: '영양제명',
    example: '바이오 밸런스'
  })
  productName: string;

  @ApiProperty({
    description: '현재 루틴 정렬 순서 (999 = 루틴에서 삭제됨)',
    example: 1
  })
  displayOrder: number;

  @ApiProperty({
    description: '7일간 일별 섭취 상태 (월요일~일요일)',
    type: [DailySupplementStatusDto],
    example: [
      { date: '2025-07-20', intakeCount: 1, recommendedCount: 1 },
      { date: '2025-07-21', intakeCount: 0, recommendedCount: 1 },
      { date: '2025-07-22', intakeCount: 0, recommendedCount: 1 },
      { date: '2025-07-23', intakeCount: 1, recommendedCount: 1 },
      { date: '2025-07-24', intakeCount: null, recommendedCount: null },
      { date: '2025-07-25', intakeCount: null, recommendedCount: null },
      { date: '2025-07-26', intakeCount: null, recommendedCount: null }
    ]
  })
  dailyStats: DailySupplementStatusDto[];
}

/**
 * 영양소 섭취량 통계 DTO
 */
export class NutrientIntakeDto {
  @ApiProperty({
    description: '영양소명',
    example: '아연'
  })
  nutrientName: string;

  @ApiProperty({
    description: '실제 섭취량 (횟수)',
    example: 16
  })
  intakeCount: number;

  @ApiProperty({
    description: '권장 섭취량 (횟수)',
    example: 21
  })
  recommendedCount: number;

  @ApiProperty({
    description: '해당 영양소가 포함된 영양제 이름 목록',
    example: ['바이오 밸런스', '클린 밸런스'],
    type: [String]
  })
  supplementNames: string[];
}

/**
 * 영양제 통계 응답 DTO (매트릭스 구조)
 */
export class SupplementStatisticsDto {
  @ApiProperty({
    description: '통계 시작일 (월요일)',
    example: '2025-07-20'
  })
  startDate: string;

  @ApiProperty({
    description: '통계 종료일 (일요일)',
    example: '2025-07-26'
  })
  endDate: string;

  @ApiProperty({
    description: '영양제별 주간 통계 (display_order 순서)',
    type: [SupplementWeeklyStatsDto],
    example: [
      {
        productId: 4,
        productName: '바이오 밸런스',
        displayOrder: 1,
        dailyStats: [
          { date: '2025-07-20', intakeCount: 1, recommendedCount: 1 },
          { date: '2025-07-21', intakeCount: 0, recommendedCount: 1 }
        ]
      }
    ]
  })
  supplements: SupplementWeeklyStatsDto[];

  @ApiProperty({
    description: '영양소별 섭취량 통계 (1그룹 영양제 기준)',
    type: [NutrientIntakeDto],
    example: [
      { nutrientName: '아연', intakeCount: 8, recommendedCount: 21 },
      { nutrientName: '비타민D', intakeCount: 14, recommendedCount: 21 }
    ]
  })
  nutrients: NutrientIntakeDto[];

  @ApiProperty({
    description: '오늘 기록한 영양제 수',
    example: 2
  })
  currentCount: number;

  @ApiProperty({
    description: '하루 최대 기록 가능 수',
    example: 10
  })
  maxCount: number;
}

// ========================================
// ⏰ 간헐적단식 통계 DTO (형님 데이터셋 기준)
// ========================================

/**
 * 간헐적단식 주간 점수 DTO
 */
export class FastingWeekScoreDto {
  @ApiProperty({ description: '단식 기록일 (YYYY-MM-DD)', example: '2025-09-10' })
  date: string;

  @ApiProperty({ description: '단식 시작 날짜+시간', example: '2025-10-26 20:00:00' })
  startDateTime: string;

  @ApiProperty({ description: '단식 종료 날짜+시간', example: '2025-10-27 12:00:00' })
  endDateTime: string;

  @ApiProperty({ description: '단식 시간', example: '16' })
  value: string;

  @ApiProperty({ description: '목표 시간 (고정값)', example: 16 })
  targetHour: number;

  @ApiProperty({ description: '완료 여부 (16시간 이상)', example: true })
  isCompleted: boolean;
}

/**
 * 간헐적단식 상세 데이터 DTO
 */
export class FastingDetailDataDto {
  @ApiProperty({ description: '달성률 점수 (7일중 isCompleted가 true인 백분율)', example: 60 })
  score: number;

  @ApiProperty({ description: '목표 시간 (고정값)', example: 16 })
  targetHour: number;

  @ApiProperty({ description: '주간 점수 배열', type: [FastingWeekScoreDto] })
  weekScore: FastingWeekScoreDto[];
}

/**
 * 간헐적단식 요약 DTO
 */
export class FastingSummaryDto {
  @ApiProperty({ description: '평균 단식시간', example: 10 })
  score: number;
}

/**
 * 간헐적단식 통계 응답 DTO
 */
export class FastingStatisticsDto {
  @ApiProperty({ description: '통계 요약', type: FastingSummaryDto })
  summary: FastingSummaryDto;

  @ApiProperty({ description: '상세 데이터', type: FastingDetailDataDto })
  detailData: FastingDetailDataDto;

  @ApiProperty({ description: '현재 기록 수', example: 5 })
  currentCount: number;

  @ApiProperty({ description: '최대 기록 수 (1일 1회)', example: 1 })
  maxCount: number;
}

// ========================================
// 😴 수면 통계 DTO (형님 데이터셋 기준)
// ========================================

/**
 * 수면 주간 점수 DTO
 */
export class SleepWeekScoreDto {
  @ApiProperty({ description: '수면 기록일 (YYYY-MM-DD)', example: '2025-09-10' })
  date: string;

  @ApiProperty({ description: '취침 날짜+시간', example: '2025-10-26 23:30:00' })
  bedDateTime: string;

  @ApiProperty({ description: '기상 날짜+시간', example: '2025-10-27 07:00:00' })
  wakeDateTime: string;

  @ApiProperty({ description: '수면 시간', example: '7.5' })
  value: string;

  @ApiProperty({ description: '목표 시간 (고정값)', example: 8 })
  targetHour: number;

  @ApiProperty({ description: '완료 여부 (8시간 이상)', example: false })
  isCompleted: boolean;
}

/**
 * 수면 상세 데이터 DTO
 */
export class SleepDetailDataDto {
  @ApiProperty({ description: '달성률 점수 (7일중 isCompleted가 true인 백분율)', example: 60 })
  score: number;

  @ApiProperty({ description: '목표 시간 (고정값)', example: 8 })
  targetHour: number;

  @ApiProperty({ description: '주간 점수 배열', type: [SleepWeekScoreDto] })
  weekScore: SleepWeekScoreDto[];
}

/**
 * 수면 요약 DTO
 */
export class SleepSummaryDto {
  @ApiProperty({ description: '평균 수면시간', example: 10 })
  score: number;
}

/**
 * 수면 통계 응답 DTO
 */
export class SleepStatisticsDto {
  @ApiProperty({ description: '통계 요약', type: SleepSummaryDto })
  summary: SleepSummaryDto;

  @ApiProperty({ description: '상세 데이터', type: SleepDetailDataDto })
  detailData: SleepDetailDataDto;

  @ApiProperty({ description: '현재 기록 수', example: 6 })
  currentCount: number;

  @ApiProperty({ description: '최대 기록 수 (1일 1회)', example: 1 })
  maxCount: number;
}

// ========================================
// 🏃 활동 통계 DTO
// ========================================

/**
 * 운동별 분석 정보
 */
export interface ExerciseAnalysis {
  exerciseName: string; // 운동명
  totalCalories: number; // 총 소모 칼로리
  sessions: number; // 운동 횟수
}

/**
 * 활동 기록 상세 정보
 */
export class ActivityDetail {
  @ApiProperty({
    description: '운동 종목 코드',
    example: 'RUNNING'
  })
  code: string;

  @ApiProperty({
    description: '운동 종목명',
    example: '달리기'
  })
  name: string;

  @ApiProperty({
    description: '소모 칼로리',
    example: '22.3'
  })
  calorie_burned: string;
}

/**
 * 일별 활동 정보
 */
export class DailyActivity {
  @ApiProperty({
    description: '날짜',
    example: '2025-09-10'
  })
  date: string;

  @ApiProperty({
    description: '요일',
    example: '월'
  })
  dayOfWeek: string;

  @ApiProperty({
    description: '해당 날짜의 활동 목록',
    type: [ActivityDetail]
  })
  activity: ActivityDetail[];
}

/**
 * 활동 통계 상세 데이터
 */
export class ActivityDetailData {
  @ApiProperty({
    description: '주간 총 점수',
    example: 483
  })
  score: number;

  @ApiProperty({
    description: '준수율 (%) - 실제 수행일수 / 총 일수 × 100',
    example: 86
  })
  complianceRate: number;

  @ApiProperty({
    description: '일별 점수 (칼로리)',
    example: [
      { date: '2025-09-10', value: 420, hasRecord: true, achievementRate: 105 },
      { date: '2025-09-11', value: 450, hasRecord: true, achievementRate: 113 }
    ]
  })
  weekScore: DailyData[];

  @ApiProperty({
    description: '일별 활동 상세',
    type: [DailyActivity]
  })
  weekActivity: DailyActivity[];
}

/**
 * 활동 통계 요약 정보
 */
export class ActivitySummary {
  @ApiProperty({
    description: '점수',
    example: 483
  })
  score: number;
}

/**
 * 활동 통계 응답 DTO (새로운 구조)
 */
export class ActivityStatisticsDto {
  @ApiProperty({
    description: '요약 정보',
    type: ActivitySummary
  })
  summary: ActivitySummary;

  @ApiProperty({
    description: '상세 데이터',
    type: ActivityDetailData
  })
  detailData: ActivityDetailData;

  @ApiProperty({ description: '현재 기록 수', example: 12 })
  currentCount: number;

  @ApiProperty({ description: '최대 기록 수 (1일 5회)', example: 5 })
  maxCount: number;
}

// ========================================
// 📊 통계 목록 (요약) DTO
// ========================================

/**
 * 통계 요약 카드 인터페이스
 */
export interface StatisticsSummaryCard {
  type: 'BEAUTY' | 'DIET' | 'SUPPLEMENT' | 'FASTING' | 'SLEEP' | 'ACTIVITY';
  // title?: string;
  // mainValue?: string | number;
  score?: number;
  // unit?: string;
  status?: string; // '좋음', '양호', '주의', '나쁨' 등
  weeklyData?: any; // 유연한 타입으로 변경

  // 추가 세부 데이터 (선택적)
  innerBeauty?: any;
  outerBeauty?: any;
  allergyFoods?: any;
  healthFoods?: any;
  processedFoods?: any;
  [key: string]: any; // 추가 필드들 허용
}

/**
 * 통계 목록 (요약) 응답 DTO
 */
export class StatisticsSummaryDto {
  @ApiProperty({
    description: '통계 기준 날짜 범위',
    example: {
      startDate: '2025-10-27',
      endDate: '2025-11-02'
    }
  })
  dateRange: {
    startDate: string;
    endDate: string;
  };

  @ApiProperty({
    description: '뷰티 통계',
    type: () => BeautyStatisticsDto
  })
  beauty: BeautyStatisticsDto;

  @ApiProperty({
    description: '다이어트 통계',
    type: () => DietStatisticsDto
  })
  diet: DietStatisticsDto;

  @ApiProperty({
    description: '단식 통계',
    type: () => FastingStatisticsDto
  })
  fasting: FastingStatisticsDto;

  @ApiProperty({
    description: '수면 통계',
    type: () => SleepStatisticsDto
  })
  sleep: SleepStatisticsDto;

  @ApiProperty({
    description: '활동 통계',
    type: () => ActivityStatisticsDto
  })
  activity: ActivityStatisticsDto;
}

// ========================================
// 📈 통계 응답 래퍼 DTO들
// ========================================

export class BeautyStatisticsResponseDto extends ApiResponseDto<BeautyStatisticsDto> {
  @ApiProperty({ type: BeautyStatisticsDto })
  data: BeautyStatisticsDto;
}

export class DietStatisticsResponseDto extends ApiResponseDto<DietStatisticsDto> {
  @ApiProperty({ type: DietStatisticsDto })
  data: DietStatisticsDto;
}

export class SupplementStatisticsResponseDto extends ApiResponseDto<SupplementStatisticsDto> {
  @ApiProperty({ type: SupplementStatisticsDto })
  data: SupplementStatisticsDto;
}

export class FastingStatisticsResponseDto extends ApiResponseDto<FastingStatisticsDto> {
  @ApiProperty({ type: FastingStatisticsDto })
  data: FastingStatisticsDto;
}

export class SleepStatisticsResponseDto extends ApiResponseDto<SleepStatisticsDto> {
  @ApiProperty({ type: SleepStatisticsDto })
  data: SleepStatisticsDto;
}

export class ActivityStatisticsResponseDto extends ApiResponseDto<ActivityStatisticsDto> {
  @ApiProperty({ type: ActivityStatisticsDto })
  data: ActivityStatisticsDto;
}

export class StatisticsSummaryResponseDto extends ApiResponseDto<StatisticsSummaryDto> {
  @ApiProperty({ type: StatisticsSummaryDto })
  data: StatisticsSummaryDto;
}