import { ApiProperty } from '@nestjs/swagger';

/**
 * AI Agent 통계 API 응답 DTO
 *
 * 목적: AI Agent 서버가 사용자 분석에 필요한 모든 데이터를 한 번에 제공
 * 포함 데이터:
 * - 음식물과민증 검사 결과 (외부 API)
 * - 사용자 기본 정보 (이름, 뷰티유형, AI코치유형, MBTI)
 * - 미션 및 게임 데이터 (자기선언문, 칭찬하기, 1일1미션, 밸런스게임)
 * - 6대 기록 데이터 (뷰티, 식단, 영양제, 간헐적단식, 수면, 활동)
 */

// ========================================
// 음식물과민증 검사 결과
// ========================================
export class IggLevelDto {
  @ApiProperty({ description: '결과지 ID', example: 'TA11150002' })
  chartId: string;

  @ApiProperty({ description: '사용자 이름', example: '최대길' })
  userName: string;

  @ApiProperty({ description: '레벨1 음식 목록', example: '캐슈너트,헤이즐넛,마카다미아너트' })
  level1: string;

  @ApiProperty({ description: '레벨2 음식 목록', example: '아몬드,브라질너트,카카오' })
  level2: string;

  @ApiProperty({ description: '레벨3 음식 목록', example: '잣,해바라기씨,호밀' })
  level3: string;

  @ApiProperty({ description: '레벨4 음식 목록', example: '코코넛,올리브' })
  level4: string;

  @ApiProperty({ description: '레벨5 음식 목록', example: '수박' })
  level5: string;
}

// ========================================
// 1일1미션 응답 DTO
// ========================================
export class DailyMissionDto {
  @ApiProperty({ description: '미션명', example: '물 2L 마시기' })
  미션명: string;

  @ApiProperty({ description: '생성일시', example: '2025-10-23 02:40:11.000' })
  createdAt: string;
}

export class DailyMissionResponseDto {
  @ApiProperty({ description: '챌린지 일차', example: 5 })
  챌린지일차: number;

  @ApiProperty({ description: '수행한 미션 수', example: 2 })
  수행한미션수: number;

  @ApiProperty({ description: '미션 목록', type: [DailyMissionDto] })
  data: DailyMissionDto[];
}

// ========================================
// 밸런스 게임 이력
// ========================================
export class BalanceGameHistoryDto {
  @ApiProperty({ description: '게임 제목', example: '외모버프' })
  title: string;

  @ApiProperty({ description: '게임 설명', example: '둘 중 하나만 가질 수 있다면 어떤걸 선택할래?' })
  description: string;

  @ApiProperty({ description: '선택한 옵션 텍스트', example: '장원영 얼굴' })
  option: string;

  @ApiProperty({ description: '키워드', example: '활성산소' })
  keyword: string;

  @ApiProperty({ description: '연결 제품', example: '영데이즈' })
  linkedProduct: string;

  @ApiProperty({ description: '완료 일시', example: '2025-09-25T09:18:10.185Z' })
  createdAt: string;
}

// ========================================
// 뷰티 기록 (일별)
// ========================================
export class BeautyRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-10' })
  date: string;

  @ApiProperty({ description: '총점', example: 120 })
  totalScore: number;

  @ApiProperty({ description: '이너뷰티 점수', example: 70 })
  innerBeautyScore: number;

  @ApiProperty({ description: '아우터뷰티 점수', example: 50 })
  outerBeautyScore: number;

  @ApiProperty({
    description: '이너뷰티 답변별 점수',
    example: [
      { no: 1, score: 25 },
      { no: 2, score: 20 },
      { no: 3, score: 15 },
      { no: 4, score: 10 }
    ]
  })
  innerBeauty: Array<{ no: number; score: number }>;

  @ApiProperty({
    description: '아우터뷰티 답변별 점수',
    example: [
      { no: 1, score: 5 },
      { no: 2, score: 10 },
      { no: 3, score: 15 },
      { no: 4, score: 20 }
    ]
  })
  outerBeauty: Array<{ no: number; score: number }>;
}

// ========================================
// 식단 기록 (끼니별)
// ========================================
export class DietRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-10' })
  date: string;

  @ApiProperty({ description: '식사 타입', example: 'BREAKFAST' })
  diet: string;

  @ApiProperty({ description: '음식 이름', example: '햄버거', nullable: true })
  foodName: string | null;

  @ApiProperty({ description: '이미지 URL', example: 'https://example.com/image.jpg', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: '단식 여부', example: false })
  isFasting: boolean;

  @ApiProperty({
    description: '과민 음식 목록',
    example: [{ name: '밀가루', level: 3 }]
  })
  allergyFoods: Array<{ name: string; level: number }>;

  @ApiProperty({ description: '과민 음식 점수', example: 1 })
  allergyScore: number;

  @ApiProperty({ description: '가공식품 개수', example: 3 })
  processedCount: number;

  @ApiProperty({ description: '가공식품 목록', example: ['빵', '패티', '소스'] })
  processedFoods: string[];

  @ApiProperty({ description: '고포드맵 음식 개수', example: 1 })
  highFodmapCount: number;

  @ApiProperty({ description: '고포드맵 음식 목록', example: ['양파'] })
  highFodmapFoods: string[];
}

// ========================================
// 간헐적단식 기록 (일별)
// ========================================
export class FastingRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-10' })
  date: string;

  @ApiProperty({ description: '단식 시작 시간', example: '2025-11-09 18:00:00' })
  startDateTime: string;

  @ApiProperty({ description: '단식 종료 시간', example: '2025-11-10 13:00:00' })
  endDateTime: string;

  @ApiProperty({ description: '단식 시간 (시간)', example: 19 })
  fastingHours: number;
}

// ========================================
// 수면 기록 (일별)
// ========================================
export class SleepRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-10' })
  date: string;

  @ApiProperty({ description: '취침 시간', example: '2025-11-10 20:30:00' })
  bedDateTime: string;

  @ApiProperty({ description: '기상 시간', example: '2025-11-11 09:00:00' })
  wakeDateTime: string;

  @ApiProperty({ description: '수면 시간 (시간)', example: 12.5 })
  sleepHours: number;
}

// ========================================
// 영양제 기록 (일별 제품별)
// ========================================
export class SupplementRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-26' })
  date: string;

  @ApiProperty({ description: '제품명', example: '바이오 밸런스' })
  productName: string;

  @ApiProperty({ description: '실제 섭취 횟수', example: 1 })
  intakeCount: number;

  @ApiProperty({ description: '권장 섭취 횟수', example: 1 })
  recommendedCount: number;

  @ApiProperty({ description: '포함 영양소 목록', example: ['마그네슘', '아연', '셀레늄'] })
  nutrients: string[];
}

// ========================================
// 활동 기록 (일별 + 활동별)
// ========================================
export class ActivityTypeDto {
  @ApiProperty({ description: '활동 코드', example: 'GOLF' })
  code: string;

  @ApiProperty({ description: '활동 이름', example: '골프' })
  name: string;

  @ApiProperty({ description: '기준 시간 (분)', example: 10 })
  base_minutes: number;

  @ApiProperty({ description: '칼로리 비율', example: 50 })
  calorie_rate: number;
}

export class ActivityRecordDto {
  @ApiProperty({ description: '기록 날짜', example: '2025-11-10' })
  date: string;

  @ApiProperty({ description: '이미지 URL', example: 'https://example.com/golf-1102.jpg', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: '활동 시간 (HH:MM:SS)', example: '02:30:00' })
  activityTime: string;

  @ApiProperty({ description: '활동 타입 정보' })
  activityType: ActivityTypeDto;

  @ApiProperty({ description: '총 지속시간 (분)', example: 150 })
  totalDuration: number;

  @ApiProperty({ description: '활동 시간 (분)', example: 150 })
  durationInMinutes: number;

  @ApiProperty({ description: '예상 소모 칼로리', example: 750 })
  estimatedCalories: number;
}

// ========================================
// 메인 응답 DTO
// ========================================
export class AiAgentStatisticsDto {
  @ApiProperty({ description: '음식물과민증 검사 결과', type: [IggLevelDto] })
  음식물과민증검사결과: IggLevelDto[];

  @ApiProperty({ description: '사용자 이름', example: '홍길동' })
  이름: string;

  @ApiProperty({ description: '이너뷰티 유형', example: '화끈한 불여우' })
  이너뷰티유형: string;

  @ApiProperty({ description: 'AI 코치 유형', example: '메이브' })
  AI코치유형: string;

  @ApiProperty({ description: 'MBTI', example: '없음' })
  MBTI: string;

  @ApiProperty({ description: '자기 선언문', example: '나는 어쩌고 저쩌고 선언한다.' })
  자기선언문: string;

  @ApiProperty({ description: '칭찬하기', example: '나를 칭찬한다.' })
  칭찬하기: string;

  @ApiProperty({ description: '1일1미션 정보', type: DailyMissionResponseDto })
  '1일1미션': DailyMissionResponseDto;

  @ApiProperty({ description: '밸런스게임 선택 이력', type: [BalanceGameHistoryDto] })
  밸런스게임: BalanceGameHistoryDto[];

  @ApiProperty({ description: '뷰티 기록 목록', type: [BeautyRecordDto] })
  뷰티: BeautyRecordDto[];

  @ApiProperty({ description: '식단 기록 목록', type: [DietRecordDto] })
  식단: DietRecordDto[];

  @ApiProperty({ description: '영양제 기록 목록 (제품별 섭취 통계)', type: [SupplementRecordDto] })
  영양제: SupplementRecordDto[];

  @ApiProperty({ description: '간헐적단식 기록 목록', type: [FastingRecordDto] })
  간헐적단식: FastingRecordDto[];

  @ApiProperty({ description: '수면 기록 목록', type: [SleepRecordDto] })
  수면: SleepRecordDto[];

  @ApiProperty({ description: '활동 기록 목록', type: [ActivityRecordDto] })
  활동: ActivityRecordDto[];
}
