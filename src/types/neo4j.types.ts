/**
 * Neo4j Node Data Types
 * Neo4j에 저장할 때 사용하는 데이터 타입 정의
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👤 User Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface UserNodeData {
  chartId: string;
  name?: string;
  innerBeautyType?: string;
  aiCoachType?: string;
  mbti?: string;
  selfDeclaration?: string;
  praiseMessage?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💄 Beauty Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface BeautyNodeData {
  chartId: string;
  dateId: string;
  date: string;
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: string; // JSON string
  outerBeautyDetails: string; // JSON string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🍽️ Food Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface FoodNodeData {
  chartId: string;
  dateId: string;
  date: string;
  foods: FoodNodeItem[];
}

export interface FoodNodeItem {
  foodId: string;
  foodName: string;
  dietType: string;
  isFasting: boolean;
  imageUrl?: string;
  allergyFoods: string; // JSON string
  allergyScore: number;
  processedCount: number;
  processedFoods: string; // JSON string
  highFodmapCount: number;
  highFodmapFoods: string; // JSON string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⏰ Fasting Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface FastingNodeData {
  chartId: string;
  dateId: string;
  date: string;
  startDateTime: string;
  endDateTime: string;
  fastingHours: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 😴 Sleep Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface SleepNodeData {
  chartId: string;
  dateId: string;
  date: string;
  bedDateTime: string;
  wakeDateTime: string;
  sleepHours: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏃 Activity Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface ActivityNodeData {
  chartId: string;
  dateId: string;
  date: string;
  totalCalories: number;
  activityCount: number;
  totalDurationMinutes: number;
  activities: ActivityNodeItem[];
}

export interface ActivityNodeItem {
  activityId: string;
  activityTypeCode: string;
  name: string;
  activityTime: string;
  durationMinutes: number;
  caloriesBurned: number;
  imageUrl?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚨 Allergy Report Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface AllergyReportNodeData {
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
// 🎯 Mission Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface MissionNodeData {
  chartId: string;
  missions: MissionNodeItem[];
}

export interface MissionNodeItem {
  missionId: string;
  content: string;
  missionType: string;
  orderIndex: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎮 Balance Game Node Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface BalanceGameNodeData {
  chartId: string;
  games: BalanceGameNodeItem[];
}

export interface BalanceGameNodeItem {
  gameId: string;
  title: string;
  description: string;
  selectedOption: string;
  keyword: string;
  linkedProduct: string;
  playedAt: string;
}
