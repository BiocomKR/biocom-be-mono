/**
 * BullMQ Queue Job 타입 정의
 *
 * @description
 * - biocom-api (Producer) → biocom-mq (Consumer) 간 데이터 인터페이스
 * - 총 10개 Queue Job 타입 정의
 *
 * @author Claude Code
 * @date 2025-12-01
 */

/**
 * 1. User Queue - 사용자 기본 정보
 */
export interface UserSyncJob {
  chartId: string;
  name: string;
  innerBeautyType: string;
  outerBeautyType: string;
  gender: string;
  age: number;
}

/**
 * 2. Beauty Queue - 뷰티 점수
 */
export interface BeautySyncJob {
  chartId: string;
  dateId: string;
  date: string; // ISO date: "2025-11-28"
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: Array<{ no: number; score: number }>;
  outerBeautyDetails: Array<{ no: number; score: number }>;
}

/**
 * 3. Food Queue - 음식 섭취 기록
 */
export interface FoodSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  foods: Array<{
    foodId: string;
    foodName: string;
    dietType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'LATENIGHT';
    isFasting: boolean;
    imageUrl?: string;
    allergyFoods: Array<{ name: string; level: number }>;
    allergyScore: number;
    processedCount: number;
    processedFoods: string[];
    highFodmapCount: number;
    highFodmapFoods: string[];
  }>;
}

/**
 * 4. Fasting Queue - 단식 기록
 */
export interface FastingSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  startDateTime: string; // ISO 8601: "2025-11-28T20:00:00"
  endDateTime: string;
  fastingHours: number;
  isFastingDay: boolean;
}

/**
 * 5. Sleep Queue - 수면 기록
 */
export interface SleepSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  bedDateTime: string;
  wakeDateTime: string;
  sleepHours: number;
  sleepQuality: 'GOOD' | 'NORMAL' | 'POOR';
}

/**
 * 6. Activity Queue - 운동 기록
 */
export interface ActivitySyncJob {
  chartId: string;
  dateId: string;
  date: string;
  totalCalories: number;
  activityCount: number;
  totalDurationMinutes: number;
  activities: Array<{
    activityId: string;
    activityTypeId: string;
    activityName: string;
    durationMinutes: number;
    calories: number;
    intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

/**
 * 7. Allergy Report Queue - 알레르기 검사
 */
export interface AllergyReportSyncJob {
  chartId: string;
  testDate: string;
  allergenCount: number;
  allergenDetails: Array<{
    name: string;
    level: number;
    category: string;
  }>;
  hasTestResult: boolean;
}

/**
 * 8. Mission Queue - 미션 목록
 */
export interface MissionSyncJob {
  chartId: string;
  missions: Array<{
    missionId: string;
    description: string;
    isCompleted: boolean;
    completedDate?: string;
    rewardPoints: number;
    category: 'DAILY' | 'WEEKLY' | 'SPECIAL';
  }>;
}

/**
 * 9. Balance Game Queue - 밸런스 게임
 */
export interface BalanceGameSyncJob {
  chartId: string;
  balanceGames: Array<{
    gameId: string;
    question: string;
    optionA: string;
    optionB: string;
    userChoice: 'A' | 'B';
    playedDate: string;
    resultAnalysis: string;
  }>;
}

/**
 * 10. Supplement Queue - 영양제 섭취 기록
 */
export interface SupplementSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  supplements: Array<{
    supplementId: string;
    supplementName: string;
    intakeCount: number;
    recommendedCount: number;
    nutrients: string[];
  }>;
}
