/**
 * Queue Job Data Types
 * biocom-api에서 Queue에 추가하는 데이터 타입 정의
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 User Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface UserSyncJob {
  chartId: string;
  name?: string;
  innerBeautyType?: string;
  aiCoachType?: string;
  mbti?: string;
  selfDeclaration?: string;
  praiseMessage?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💄 Beauty Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface BeautySyncJob {
  chartId: string;
  dateId: string;
  date: string;
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: { no: number; score: number }[];
  outerBeautyDetails: { no: number; score: number }[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🍽️ Food Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface FoodSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  foods: FoodItem[];
}

export interface FoodItem {
  foodId: string;
  foodName: string;
  dietType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'LATENIGHT';
  isFasting: boolean;
  imageUrl?: string;
  allergyFoods: { name: string; level: number }[];
  allergyScore: number;
  processedCount: number;
  processedFoods: string[];
  highFodmapCount: number;
  highFodmapFoods: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⏰ Fasting Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface FastingSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  startDateTime: string;
  endDateTime: string;
  fastingHours: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 😴 Sleep Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface SleepSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  bedDateTime: string;
  wakeDateTime: string;
  sleepHours: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏃 Activity Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface ActivitySyncJob {
  chartId: string;
  dateId: string;
  date: string;
  totalCalories: number;
  activityCount: number;
  totalDurationMinutes: number;
  activities: ActivityItem[];
}

export interface ActivityItem {
  activityId: string;
  activityTypeCode: string;
  name: string;
  activityTime: string;
  durationMinutes: number;
  estimatedCalories: number;
  imageUrl?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚨 Allergy Report Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface AllergyReportSyncJob {
  chartId: string;
  reportId: string;
  level1Foods: string;
  level2Foods: string;
  level3Foods: string;
  level4Foods: string;
  level5Foods: string;
  testedAt?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 Mission Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface MissionSyncJob {
  chartId: string;
  missions: MissionItem[];
}

export interface MissionItem {
  missionId: string;
  content: string;
  missionType: string;
  orderIndex: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎮 Balance Game Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface BalanceGameSyncJob {
  chartId: string;
  games: BalanceGameItem[];
}

export interface BalanceGameItem {
  gameId: string;
  title: string;
  description: string;
  selectedOption: string;
  keyword: string;
  linkedProduct: string;
  playedAt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💊 Supplement Sync Job
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface SupplementSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  supplements: SupplementItem[];
}

export interface SupplementItem {
  supplementId: string;
  supplementName: string;
  intakeCount: number;
  recommendedCount: number;
  nutrients: string[];
}
