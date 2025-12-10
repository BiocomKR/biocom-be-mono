import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import { getDayOfWeek, formatKoreanDate } from '../../common/utils/korea-date.util';
import {
  BeautyStatisticsDto,
  DietStatisticsDto,
  SupplementStatisticsDto,
  FastingStatisticsDto,
  SleepStatisticsDto,
  ActivityStatisticsDto,
  StatisticsSummaryDto,
  DailyData,
  AchievementInfo,
  StatisticsSummaryCard,
  ExerciseAnalysis,
  DailyActivity,
  ActivityDetail
} from '../dto/statistics/statistics.dto';
import { AiAgentStatisticsDto } from '../dto/statistics/ai-agent-statistics.dto';

/**
 * 통계 서비스
 * 6가지 기록 유형별 1주일 고정 통계 제공
 * 
 * 기간 설정: 1주일 고정 (기획 변경 시 확장 가능하도록 주석 처리)
 * 기준 날짜: 오늘부터 과거 7일간 (오늘 포함)
 */
@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * 1주일 날짜 범위 계산 (전일기준 7일치)
   * @returns 시작일, 종료일 정보 (String 형식)
   */
  private getWeekDateRange() {
    const today = getNowKST();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // 어제를 종료일로

    const startDate = new Date(yesterday);
    startDate.setDate(yesterday.getDate() - 6); // 어제부터 역산 7일

    return {
      startDate: formatKoreanDate(startDate),
      endDate: formatKoreanDate(yesterday)
    };
  }

  /**
   * 이전 주 날짜 범위 계산 (비교용)
   * @returns 이전 주 시작일, 종료일 정보 (String 형식)
   */
  private getPreviousWeekDateRange() {
    const today = getNowKST();
    const currentWeekEnd = new Date(today);
    currentWeekEnd.setDate(today.getDate() - 1); // 전일

    const previousWeekEnd = new Date(currentWeekEnd);
    previousWeekEnd.setDate(currentWeekEnd.getDate() - 7); // 이전 주 종료일

    const previousWeekStart = new Date(previousWeekEnd);
    previousWeekStart.setDate(previousWeekEnd.getDate() - 6); // 이전 주 시작일

    return {
      startDate: formatKoreanDate(previousWeekStart),
      endDate: formatKoreanDate(previousWeekEnd)
    };
  }

  /**
   * 7일간 날짜 배열 생성
   */
  private generateWeekDates(startDate: string): string[] {
    const dates: string[] = [];
    const [year, month, day] = startDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);

    for (let i = 0; i < 7; i++) {
      dates.push(formatKoreanDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 달성률 계산 헬퍼
   */
  private calculateAchievement(achievedDays: number, totalDays: number = 7): AchievementInfo {
    const percentage = Math.round((achievedDays / totalDays) * 100);
    return {
      achievedDays,
      totalDays,
      percentage
    };
  }

  /**
   * 시간 문자열 배열의 평균 시간 계산 헬퍼
   * @param times 시간 문자열 배열 (예: ["23:30", "23:45", "00:15"])
   * @returns 평균 시간 문자열 (예: "23:50")
   */
  private calculateAverageTime(times: string[]): string {
    if (times.length === 0) return '00:00';

    // 유효한 시간만 필터링 (기본값 제외)
    const validTimes = times.filter(time => time !== '00:00' && time !== '23:00' && time !== '07:00');

    if (validTimes.length === 0) {
      // 모든 값이 기본값인 경우, 첫 번째 값 반환
      return times[0] || '00:00';
    }

    let totalMinutes = 0;

    validTimes.forEach(time => {
      const [hours, minutes] = time.split(':').map(Number);
      // 자정을 넘나드는 시간 처리 (예: 23:30 -> 1410분, 00:30 -> 30분이지만 다음날로 간주하여 1470분)
      let timeInMinutes = hours * 60 + minutes;

      // 새벽 시간대 (0-6시)는 다음날로 간주
      if (hours >= 0 && hours <= 6) {
        timeInMinutes += 24 * 60;
      }

      totalMinutes += timeInMinutes;
    });

    const averageMinutes = Math.round(totalMinutes / validTimes.length);

    // 24시간을 넘는 경우 24시간으로 나눈 나머지 사용
    const finalMinutes = averageMinutes % (24 * 60);

    const hours = Math.floor(finalMinutes / 60);
    const minutes = finalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // ========================================
  // 🌸 이너뷰티 통계
  // ========================================

  /**
   * 이너뷰티 통계 조회 (형님 정확한 데이터셋 기준)
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD)
   * @param endDate 종료일 (YYYY-MM-DD)
   */
  async getBeautyStatistics(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<BeautyStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`이너뷰티 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 이너뷰티 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleBeautyStatistics(startDate, endDate);
      }

      // 뷰티 기록 조회
      const currentWeekRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'BEAUTY',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: { date: 'asc' }
      });

      const weekDates = this.generateWeekDates(startDate);

      // 이번 주 데이터 분석
      const currentWeekAnalysis = this.analyzeBeautyDataForCorrectStructure(currentWeekRecords, weekDates);

      this.logger.log(`이너뷰티 통계 조회 완료 - 사용자: ${userId}, 종합점수: ${currentWeekAnalysis.summaryScore}`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'BEAUTY');

      // 형님이 정확히 요청한 데이터셋 구조
      return {
        summary: {
          score: currentWeekAnalysis.summaryScore,
          weekScore: currentWeekAnalysis.summaryWeekScore
        },
        detailData: {
          innerBeauty: {
            score: currentWeekAnalysis.innerScore,
            weekScore: currentWeekAnalysis.innerWeekScore,
            answer: currentWeekAnalysis.innerAnswers
          },
          outerBeauty: {
            score: currentWeekAnalysis.outerScore,
            weekScore: currentWeekAnalysis.outerWeekScore,
            answer: currentWeekAnalysis.outerAnswers
          }
        },
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
      };
    } catch (error) {
      this.logger.error(`이너뷰티 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 뷰티 데이터 분석 (형님 정확한 구조)
   */
  private analyzeBeautyDataForCorrectStructure(records: any[], weekDates: string[]) {
    // 질문별 누적 점수 (이너뷰티 1-4, 아우터뷰티 1-4)
    let innerQ1Total = 0, innerQ2Total = 0, innerQ3Total = 0, innerQ4Total = 0;
    let outerQ1Total = 0, outerQ2Total = 0, outerQ3Total = 0, outerQ4Total = 0;

    // 일별 점수 배열
    const summaryWeekScore: { date: string; value: string }[] = [];
    const innerWeekScore: { date: string; value: string }[] = [];
    const outerWeekScore: { date: string; value: string }[] = [];

    let recordCount = 0;
    let totalInnerScore = 0;
    let totalOuterScore = 0;

    // 일별 데이터 처리
    weekDates.forEach(date => {
      const record = records.find(r => {
        const recordDate = r.date instanceof Date ? formatKoreanDate(r.date) : r.date;
        return recordDate === date;
      });

      let dayInnerScore = 0;
      let dayOuterScore = 0;

      if (record && record.metadata) {
        // 새로운 구조: innerBeauty와 outerBeauty 배열 처리
        const { innerBeauty, outerBeauty } = record.metadata;

        // 이너뷰티 질문 1-4 처리
        if (innerBeauty && Array.isArray(innerBeauty)) {
          innerBeauty.forEach(item => {
            if (item.no && item.score) {
              // 질문별 누적
              if (item.no === 1) innerQ1Total += item.score;
              else if (item.no === 2) innerQ2Total += item.score;
              else if (item.no === 3) innerQ3Total += item.score;
              else if (item.no === 4) innerQ4Total += item.score;

              dayInnerScore += item.score;
            }
          });
        }

        // 아우터뷰티 질문 1-4 처리
        if (outerBeauty && Array.isArray(outerBeauty)) {
          outerBeauty.forEach(item => {
            if (item.no && item.score) {
              // 질문별 누적
              if (item.no === 1) outerQ1Total += item.score;
              else if (item.no === 2) outerQ2Total += item.score;
              else if (item.no === 3) outerQ3Total += item.score;
              else if (item.no === 4) outerQ4Total += item.score;

              dayOuterScore += item.score;
            }
          });
        }

        totalInnerScore += dayInnerScore;
        totalOuterScore += dayOuterScore;
        recordCount++;
      }

      // 일별 점수를 문자열로 저장 (형님 요청사항)
      const daySummaryScore = Math.round((dayInnerScore + dayOuterScore) / 2);
      summaryWeekScore.push({ date, value: daySummaryScore.toString() });
      innerWeekScore.push({ date, value: dayInnerScore.toString() });
      outerWeekScore.push({ date, value: dayOuterScore.toString() });
    });

    // 주간 평균 계산 (검색일 수 기준)
    const daysCount = weekDates.length;
    const innerScore = daysCount > 0 ? Math.round(totalInnerScore / daysCount) : 0;
    const outerScore = daysCount > 0 ? Math.round(totalOuterScore / daysCount) : 0;
    const summaryScore = Math.round((innerScore + outerScore) / 2);

    // 답변별 평균 점수 계산 (검색일 수 기준, 소수점 반올림)
    const innerAnswers = [
      { no: 1, score: daysCount > 0 ? Math.round(innerQ1Total / daysCount) : 0 },
      { no: 2, score: daysCount > 0 ? Math.round(innerQ2Total / daysCount) : 0 },
      { no: 3, score: daysCount > 0 ? Math.round(innerQ3Total / daysCount) : 0 },
      { no: 4, score: daysCount > 0 ? Math.round(innerQ4Total / daysCount) : 0 }
    ];

    const outerAnswers = [
      { no: 1, score: daysCount > 0 ? Math.round(outerQ1Total / daysCount) : 0 },
      { no: 2, score: daysCount > 0 ? Math.round(outerQ2Total / daysCount) : 0 },
      { no: 3, score: daysCount > 0 ? Math.round(outerQ3Total / daysCount) : 0 },
      { no: 4, score: daysCount > 0 ? Math.round(outerQ4Total / daysCount) : 0 }
    ];

    return {
      summaryScore,
      innerScore,
      outerScore,
      summaryWeekScore,
      innerWeekScore,
      outerWeekScore,
      innerAnswers,
      outerAnswers
    };
  }

  // ========================================
  // 🍽️ 식단 통계
  // ========================================

  /**
   * 식단 통계 조회 (새로운 구조)
   * @param userId 사용자 ID
   */
  async getDietStatistics(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<DietStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`식단 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 식단 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleDietStatistics(startDate, endDate);
      }

      // 식단 기록 조회
      const dietRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'DIET',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: { date: 'asc' }
      });

      const weekDates = this.generateWeekDates(startDate);

      // 카테고리별 일별 데이터 배열
      const allergyWeekScore: { date: string; value: string }[] = [];
      const highFodmapWeekScore: { date: string; value: string }[] = [];
      const processedWeekScore: { date: string; value: string }[] = [];

      let totalAllergyScore = 0;
      let totalHighFodmapCount = 0;
      let totalProcessedCount = 0;

      // 일별 데이터 계산
      weekDates.forEach(date => {
        const dailyRecords = dietRecords.filter(r => {
          const recordDate = r.date instanceof Date ? formatKoreanDate(r.date) : r.date;
          return recordDate === date;
        });

        let dayAllergyScore = 0;
        let dayHighFodmapCount = 0;
        let dayProcessedCount = 0;

        dailyRecords.forEach(record => {
          if (record.metadata) {
            dayAllergyScore += record.metadata.allergyScore || 0;
            dayHighFodmapCount += record.metadata.highFodmapCount || 0;
            dayProcessedCount += record.metadata.processedCount || 0;
          }
        });

        allergyWeekScore.push({ date, value: dayAllergyScore.toString() });
        highFodmapWeekScore.push({ date, value: dayHighFodmapCount.toString() });
        processedWeekScore.push({ date, value: dayProcessedCount.toString() });

        totalAllergyScore += dayAllergyScore;
        totalHighFodmapCount += dayHighFodmapCount;
        totalProcessedCount += dayProcessedCount;
      });

      // 전체 요약 점수 계산 (합계)
      const summaryScore = totalAllergyScore + totalHighFodmapCount + totalProcessedCount;

      this.logger.log(`식단 통계 조회 완료 - 사용자: ${userId}, 요약점수: ${summaryScore}`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'DIET');

      // 형님이 정확히 요청한 데이터셋 구조
      return {
        summary: {
          score: summaryScore
        },
        detailData: {
          allergyFoods: {
            score: totalAllergyScore,
            weekScore: allergyWeekScore
          },
          highFodmapFoods: {
            score: totalHighFodmapCount,
            weekScore: highFodmapWeekScore
          },
          processedFoods: {
            score: totalProcessedCount,
            weekScore: processedWeekScore
          }
        },
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
      };
    } catch (error) {
      this.logger.error(`식단 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  // ========================================
  // 💊 영양제 통계
  // ========================================

  /**
   * 영양제 통계 조회
   * @param userId 사용자 ID
   */
  /**
   * 영양제 통계 조회 (매트릭스 구조)
   * - 주간(월~일) 7일 동안의 영양제 섭취 이력을 매트릭스 형태로 반환
   * - 1그룹(기본영양제): 7일 전체 데이터 존재 (null 없음)
   * - 2,3그룹(사용자 추가): 루틴 추가 이후 날짜만 데이터 존재
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD, 월요일)
   * @param endDate 종료일 (YYYY-MM-DD, 일요일)
   * @param isNewcomer NEWCOMER 여부
   */
  async getSupplementStatistics(
    userId: number,
    startDate: string,
    endDate: string,
    isNewcomer: boolean = false,
  ): Promise<SupplementStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(
        `영양제 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate}~${endDate}, NEWCOMER: ${isNewcomer}`,
      );

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 영양제 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleSupplementStatistics(startDate, endDate);
      }

      // 1. 주간 7일 날짜 배열 생성 (YYYY-MM-DD 문자열 배열, KST 기준)
      const weekDates: string[] = [];
      const [year, month, day] = startDate.split('-').map(Number);
      const currentDate = new Date(year, month - 1, day); // 로컬 타임존 기준
      for (let i = 0; i < 7; i++) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        weekDates.push(`${y}-${m}-${d}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 2. 해당 주간의 모든 영양제 기록 조회
      const startDateTime = new Date(startDate + 'T00:00:00+09:00');
      const endDateTime = new Date(endDate + 'T23:59:59+09:00');

      const supplementRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: {
            gte: startDateTime,
            lte: endDateTime,
          },
        },
        orderBy: { date: 'asc' },
      });

      // 3. 주간에 등장한 모든 productId 추출 (중복 제거)
      const productIdSet = new Set<number>();
      supplementRecords.forEach((record) => {
        const metadata = record.metadata as any;
        if (metadata?.productId) {
          productIdSet.add(metadata.productId);
        }
      });

      const productIds = Array.from(productIdSet);

      if (productIds.length === 0) {
        // 데이터 없으면 빈 배열 반환
        return {
          startDate,
          endDate,
          supplements: [],
          nutrients: [],
          currentCount: 0,
          maxCount: 10,
        };
      }

      // 4. 현재(오늘 기준) user_supplement_routine에서 display_order 조회
      const routineList = await this.prisma.userSupplementRoutine.findMany({
        where: {
          userId,
          isActive: true,
          productId: { in: productIds },
        },
        select: {
          productId: true,
          displayOrder: true,
        },
      });

      const displayOrderMap = new Map<number, number>(
        routineList.map((r) => [r.productId, r.displayOrder]),
      );

      // 5. Product 정보 조회
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
        select: {
          id: true,
          name: true,
          productInfo: true,
        },
      });

      const productInfoMap = new Map<
        number,
        { name: string; frequencyPerDay: number }
      >(
        products.map((p) => [
          p.id,
          {
            name: p.name,
            frequencyPerDay: p.productInfo
              ? (p.productInfo as any)['frequency_per_day'] || 1
              : 1,
          },
        ]),
      );

      // 6. 날짜별 + productId별로 그룹화
      const recordsByDateAndProduct = new Map<string, Map<number, any>>();
      supplementRecords.forEach((record) => {
        const dateStr = formatKoreanDate(record.date);
        const metadata = record.metadata as any;
        const productId = metadata?.productId;

        if (!productId) return;

        if (!recordsByDateAndProduct.has(dateStr)) {
          recordsByDateAndProduct.set(dateStr, new Map());
        }

        const morning = metadata.morning || false;
        const afternoon = metadata.afternoon || false;
        const evening = metadata.evening || false;
        const intakeCount = [morning, afternoon, evening].filter(Boolean).length;

        recordsByDateAndProduct.get(dateStr)!.set(productId, {
          intakeCount,
          recommendedCount: productInfoMap.get(productId)?.frequencyPerDay || 1,
        });
      });

      // 7. 영양제별 주간 통계 생성
      const supplements = productIds.map((productId) => {
        const productInfo = productInfoMap.get(productId);
        const displayOrder = displayOrderMap.get(productId) || 999;

        // 7일 매트릭스 생성
        const dailyStats = weekDates.map((dateStr) => {
          const recordMap = recordsByDateAndProduct.get(dateStr);
          const record = recordMap?.get(productId);

          if (record) {
            // 데이터 있음
            return {
              date: dateStr,
              intakeCount: Math.min(
                record.intakeCount,
                record.recommendedCount,
              ),
              recommendedCount: record.recommendedCount,
            };
          } else {
            // 데이터 없음 = null
            return {
              date: dateStr,
              intakeCount: null,
              recommendedCount: null,
            };
          }
        });

        return {
          productId,
          productName: productInfo?.name || '알 수 없는 영양제',
          displayOrder,
          dailyStats,
        };
      });

      // 8. display_order 순서로 정렬
      supplements.sort((a, b) => a.displayOrder - b.displayOrder);

      // 9. 영양소 섭취량 통계 계산 (1그룹 영양제만)
      const nutrients = await this.calculateNutrientIntake(
        userId,
        startDate,
        endDate,
        supplementRecords,
      );

      this.logger.log(
        `영양제 통계 조회 완료 - 사용자: ${userId}, 영양제 수: ${supplements.length}, 영양소 수: ${nutrients.length}`,
      );

      return {
        startDate,
        endDate,
        supplements,
        nutrients,
        currentCount: supplements.length,
        maxCount: 10,
      };
    } catch (error) {
      this.logger.error(`영양제 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 영양소 섭취량 통계 계산 (1그룹 영양제 기준)
   * @param userId 사용자 ID
   * @param startDate 시작일
   * @param endDate 종료일
   * @param supplementRecords 영양제 기록 데이터
   */
  private async calculateNutrientIntake(
    userId: number,
    startDate: string,
    endDate: string,
    supplementRecords: any[],
  ) {
    try {
      // 1. 1그룹 영양제 조회 (isDefault: true)
      const defaultRoutine = await this.prisma.userSupplementRoutine.findMany({
        where: {
          userId,
          isDefault: true,
          isActive: true,
        },
        select: {
          productId: true,
        },
      });

      const defaultProductIds = defaultRoutine.map((r) => r.productId);

      if (defaultProductIds.length === 0) {
        return [];
      }

      // 2. 1그룹 영양제들의 영양소 조회
      const supplementNutrients =
        await this.prisma.supplementNutrient.findMany({
          where: {
            productId: { in: defaultProductIds },
          },
          select: {
            productId: true,
            nutrientName: true,
          },
        });

      // 3. 각 영양제의 frequency_per_day 및 제품명 조회
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: defaultProductIds },
        },
        select: {
          id: true,
          name: true,
          productInfo: true,
        },
      });

      const productFrequencyMap = new Map<number, number>(
        products.map((p) => [
          p.id,
          p.productInfo
            ? (p.productInfo as any)['frequency_per_day'] || 1
            : 1,
        ]),
      );

      const productNameMap = new Map<number, string>(
        products.map((p) => [p.id, p.name]),
      );

      // 4. 영양소별로 그룹화 (영양소 → 포함 영양제 목록)
      const nutrientToProducts = new Map<number, Set<number>>();
      supplementNutrients.forEach((sn) => {
        if (!nutrientToProducts.has(sn.nutrientName as any)) {
          nutrientToProducts.set(sn.nutrientName as any, new Set());
        }
        nutrientToProducts.get(sn.nutrientName as any)!.add(sn.productId);
      });

      // 5. 영양제별 실제 섭취 횟수 계산
      const productIntakeCounts = new Map<number, number>();
      defaultProductIds.forEach((productId) => {
        productIntakeCounts.set(productId, 0);
      });

      supplementRecords.forEach((record) => {
        const metadata = record.metadata as any;
        const productId = metadata?.productId;

        if (!defaultProductIds.includes(productId)) {
          return; // 1그룹 아니면 스킵
        }

        const morning = metadata.morning || false;
        const afternoon = metadata.afternoon || false;
        const evening = metadata.evening || false;

        // 실제로 몇 번 먹었는지 카운트 (morning, afternoon, evening 각각 1회)
        let dailyIntakeCount = 0;
        if (morning) dailyIntakeCount++;
        if (afternoon) dailyIntakeCount++;
        if (evening) dailyIntakeCount++;

        if (dailyIntakeCount > 0) {
          // 하루 권장량을 초과할 수 없음
          const frequency = productFrequencyMap.get(productId) || 1;
          const validIntakeCount = Math.min(dailyIntakeCount, frequency);

          const currentCount = productIntakeCounts.get(productId) || 0;
          productIntakeCounts.set(productId, currentCount + validIntakeCount);
        }
      });

      // 6. 영양소별 섭취량 계산
      const nutrients = Array.from(nutrientToProducts.entries()).map(
        ([nutrientName, productIds]) => {
          // 권장 섭취량 (분모) = Σ(frequency_per_day) × 7
          let recommendedCount = 0;
          productIds.forEach((productId) => {
            const frequency = productFrequencyMap.get(productId) || 1;
            recommendedCount += frequency * 7;
          });

          // 실제 섭취량 (분자) = Σ(실제 먹은 횟수, 단 권장량 초과 불가)
          let intakeCount = 0;
          productIds.forEach((productId) => {
            const actualIntakeCount = productIntakeCounts.get(productId) || 0;
            intakeCount += actualIntakeCount;
          });

          // 해당 영양소가 포함된 영양제 이름 목록
          const supplementNames: string[] = [];
          productIds.forEach((productId) => {
            const name = productNameMap.get(productId);
            if (name) {
              supplementNames.push(name);
            }
          });

          return {
            nutrientName: nutrientName as any,
            intakeCount,
            recommendedCount,
            supplementNames,
          };
        },
      );

      // 7. 영양소명 가나다순으로 정렬
      nutrients.sort((a, b) => a.nutrientName.localeCompare(b.nutrientName, 'ko'));

      return nutrients;
    } catch (error) {
      this.logger.error('영양소 섭취량 계산 실패', error);
      return [];
    }
  }

  // ========================================
  // ⏰ 간헐적단식 통계
  // ========================================

  /**
   * 간헐적단식 통계 조회 (형님 데이터셋 기준)
   * @param userId 사용자 ID
   */
  async getFastingStatistics(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<FastingStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`간헐적단식 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 간헐적단식 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleFastingStatistics(startDate, endDate);
      }

      // 간헐적단식 기록 조회 (FASTING)
      const fastingRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'FASTING',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      // 주간 날짜 배열 생성
      const weekDates = this.generateWeekDates(startDate);

      // 주간 점수 데이터 생성
      const weekScore = weekDates.map(date => {
        const record = fastingRecords.find(r => {
          const recordDate = r.date instanceof Date ? formatKoreanDate(r.date) : r.date;
          return recordDate === date;
        });

        if (!record || !record.metadata) {
          return {
            date,
            startDateTime: `${date} 00:00:00`,
            endDateTime: `${date} 12:00:00`,
            value: '0',
            targetHour: 16,
            isCompleted: false
          };
        }

        const metadata = record.metadata as any;
        const startDateTime = metadata.startDateTime || `${date} 00:00:00`;
        const endDateTime = metadata.endDateTime || `${date} 12:00:00`;
        const fastingHours = metadata.fastingHours || 0;
        const value = fastingHours.toString();
        const isCompleted = fastingHours >= 16; // 16시간 이상일 때 완료

        return {
          date,
          startDateTime,
          endDateTime,
          value,
          targetHour: 16,
          isCompleted
        };
      });

      // 평균 단식시간 계산 (시간 단위)
      const totalHours = weekScore.reduce((sum, item) => sum + parseFloat(item.value), 0);
      const daysCount = weekDates.length;
      const averageHours = daysCount > 0 ? totalHours / daysCount : 0;
      const averageScore = Math.round(averageHours);

      // 평균 단식시간 계산 (분 단위)
      const averageMinutes = Math.round(averageHours * 60); // 1시간 = 60분

      const summary = {
        score: averageScore
      };

      const detailData = {
        score: averageMinutes,
        targetHour: 16,
        weekScore
      };

      this.logger.log(`간헐적단식 통계 조회 완료 - 사용자: ${userId}, 평균: ${averageScore}시간 (${averageMinutes}분)`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'FASTING');

      return {
        summary,
        detailData,
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
      };

    } catch (error) {
      this.logger.error(`간헐적단식 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  // ========================================
  // 😴 수면 통계
  // ========================================

  /**
   * 수면 통계 조회 (형님 데이터셋 기준)
   * @param userId 사용자 ID
   */
  async getSleepStatistics(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<SleepStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`수면 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 수면 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleSleepStatistics(startDate, endDate);
      }

      // 수면 기록 조회 (SLEEP)
      const sleepRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SLEEP',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: {
          date: 'asc'
        }
      });

      // 주간 날짜 배열 생성
      const weekDates = this.generateWeekDates(startDate);

      // 주간 점수 데이터 생성
      const weekScore = weekDates.map(date => {
        const record = sleepRecords.find(r => {
          const recordDate = r.date instanceof Date ? formatKoreanDate(r.date) : r.date;
          return recordDate === date;
        });

        if (!record || !record.metadata) {
          return {
            date,
            bedDateTime: `${date} 23:00:00`,
            wakeDateTime: `${date} 07:00:00`,
            value: '0',
            targetHour: 8,
            isCompleted: false
          };
        }

        const metadata = record.metadata as any;
        const bedDateTime = metadata.bedDateTime || `${date} 23:00:00`;
        const wakeDateTime = metadata.wakeDateTime || `${date} 07:00:00`;
        const sleepHours = metadata.sleepHours || 0;
        const value = sleepHours.toString();
        const isCompleted = sleepHours >= 8; // 8시간 이상일 때 완료

        return {
          date,
          bedDateTime,
          wakeDateTime,
          value,
          targetHour: 8,
          isCompleted
        };
      });

      // 평균 수면시간 계산 (시간 단위)
      const totalHours = weekScore.reduce((sum, item) => sum + parseFloat(item.value), 0);
      const daysCount = weekDates.length;
      const averageHours = daysCount > 0 ? totalHours / daysCount : 0;
      const averageScore = Math.round(averageHours);

      // 평균 수면시간 계산 (분 단위)
      const averageMinutes = Math.round(averageHours * 60); // 1시간 = 60분

      const summary = {
        score: averageScore
      };

      const detailData = {
        score: averageMinutes,
        targetHour: 8,
        weekScore
      };

      this.logger.log(`수면 통계 조회 완료 - 사용자: ${userId}, 평균: ${averageScore}시간 (${averageMinutes}분)`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'SLEEP');

      return {
        summary,
        detailData,
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
      };

    } catch (error) {
      this.logger.error(`수면 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  // ========================================
  // 🏃 활동 통계
  // ========================================

  /**
   * 활동 통계 조회
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD)
   * @param endDate 종료일 (YYYY-MM-DD)
   */
  async getActivityStatistics(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<ActivityStatisticsDto> {
    try {
      // startDate, endDate 없으면 기본값 설정
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`활동 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 활동 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleActivityStatistics(startDate, endDate);
      }

      // 기준 소모칼로리 (400kcal)
      const TARGET_CALORIES = 400;

      // 1주일간 활동 기록 조회 (1일 다회 기록 지원)
      const activityRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'ACTIVITY',
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
      });

      const weekDates = this.generateWeekDates(startDate);
      const weekScore: DailyData[] = [];
      const weekActivity: DailyActivity[] = [];

      let totalCalories = 0;

      // 일별 데이터 생성
      weekDates.forEach((date) => {
        // 해당 날짜의 모든 활동 기록
        const dayRecords = activityRecords.filter((r: any) => {
          const recordDate = formatKoreanDate(new Date(r.date));
          return recordDate === date;
        });

        let dayTotalCalories = 0;
        const dayActivities: ActivityDetail[] = [];

        dayRecords.forEach((record: any) => {
          if (record.metadata && record.metadata.activityType) {
            const calories = record.metadata.estimatedCalories || 0;
            dayTotalCalories += calories;

            dayActivities.push({
              code: record.metadata.activityType.code,
              name: record.metadata.activityType.name,
              calorie_burned: calories.toString()
            });
          }
        });

        // weekScore에 일별 총 칼로리 추가
        weekScore.push({
          date,
          value: dayTotalCalories,
          hasRecord: dayRecords.length > 0
        });

        // weekActivity에 일별 활동 상세 추가 (기록이 있는 날만)
        if (dayActivities.length > 0) {
          weekActivity.push({
            date,
            dayOfWeek: getDayOfWeek(date),
            activity: dayActivities
          });
        }

        totalCalories += dayTotalCalories;
      });

      // 준수율 계산: 실제 수행일수 / 총 일수 × 100
      const performedDays = weekScore.filter(day => day.hasRecord).length;
      const totalDays = weekScore.length;
      const complianceRate = Math.round((performedDays / totalDays) * 100);

      // 주간 평균 점수 (평균 칼로리)
      const weekAverageScore = Math.round(totalCalories / totalDays);

      this.logger.log(`활동 통계 조회 완료 - 사용자: ${userId}, 총 칼로리: ${totalCalories}kcal, 평균 칼로리: ${weekAverageScore}kcal, 준수율: ${complianceRate}%`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'ACTIVITY');

      return {
        summary: {
          score: weekAverageScore
        },
        detailData: {
          score: weekAverageScore,
          complianceRate,
          weekScore,
          weekActivity
        },
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
      };
    } catch (error) {
      this.logger.error(`활동 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  // ========================================
  // 📊 통계 목록 (요약)
  // ========================================

  /**
   * 통계 목록 (요약) 조회
   * @param userId 사용자 ID
   * @param startDate 시작일
   * @param endDate 종료일
   * @param isNewcomer NEWCOMER 여부 (Guard에서 전달)
   */
  async getStatisticsSummary(userId: number, startDate: string, endDate: string, isNewcomer: boolean = false): Promise<any> {
    try {
      // startDate, endDate 없으면 기본값 설정 (전일 기준 7일)
      if (!startDate || !endDate) {
        const dateRange = this.getWeekDateRange();
        startDate = startDate || dateRange.startDate;
        endDate = endDate || dateRange.endDate;
      }

      this.logger.log(`통계 목록 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleStatisticsSummary(startDate, endDate);
      }

      // 각 통계 조회 (병렬 처리) - 완성된 5개 통계 API 응답을 그대로 묶어서 반환
      const [beauty, diet, fasting, sleep, activity, supplement] = await Promise.all([
        this.getBeautyStatistics(userId, startDate, endDate),
        this.getDietStatistics(userId, startDate, endDate),
        this.getFastingStatistics(userId, startDate, endDate),
        this.getSleepStatistics(userId, startDate, endDate),
        this.getActivityStatistics(userId, startDate, endDate),
        this.getSupplementStatistics(userId, startDate, endDate),
      ]);

      // comment, totalComment 제거 처리
      const cleanedBeauty = this.removeComments(beauty);
      const cleanedDiet = this.removeComments(diet);
      const cleanedFasting = this.removeComments(fasting);
      const cleanedSleep = this.removeComments(sleep);
      const cleanedActivity = this.removeComments(activity);
      const cleanedSupplement = this.removeComments(supplement);
      this.logger.log(`통계 목록 조회 완료 - 사용자: ${userId}`);

      // 5개 통계 응답을 그대로 반환 (프론트엔드에서 알아서 처리)
      return {
        dateRange: { startDate, endDate },
        beauty: cleanedBeauty,
        diet: cleanedDiet,
        supplement: cleanedSupplement,
        fasting: cleanedFasting,
        sleep: cleanedSleep,
        activity: cleanedActivity
      };
    } catch (error) {
      this.logger.error(`통계 목록 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

  /**
   * comment, totalComment 필드 제거 헬퍼
   */
  private removeComments(data: any): any {
    const cleaned = JSON.parse(JSON.stringify(data)); // Deep copy

    // summary.comment 제거
    if (cleaned.summary && 'comment' in cleaned.summary) {
      delete cleaned.summary.comment;
    }

    // detailData.totalComment 제거
    if (cleaned.detailData && 'totalComment' in cleaned.detailData) {
      delete cleaned.detailData.totalComment;
    }

    return cleaned;
  }

  /**
   * NEWCOMER용 예시 통계 데이터 생성
   */
  private getSampleStatisticsSummary(startDate: string, endDate: string) {
    const weekDates = this.generateWeekDates(startDate);

    return {
      dateRange: { startDate, endDate },
      beauty: {
        summary: {
          score: 61,
          weekScore: weekDates.map((date, i) => ({
            date,
            value: (75 - i * 5).toString()
          }))
        },
        detailData: {
          innerBeauty: {
            score: 61,
            weekScore: weekDates.map((date, i) => ({
              date,
              value: (80 - i * 5).toString()
            })),
            answer: [
              { no: 1, score: 16 },
              { no: 2, score: 13 },
              { no: 3, score: 16 },
              { no: 4, score: 17 }
            ]
          },
          outerBeauty: {
            score: 61,
            weekScore: weekDates.map((date, i) => ({
              date,
              value: (70 - i * 5).toString()
            })),
            answer: [
              { no: 1, score: 14 },
              { no: 2, score: 16 },
              { no: 3, score: 12 },
              { no: 4, score: 19 }
            ]
          }
        }
      },
      diet: {
        summary: {
          score: 64
        },
        detailData: {
          allergyFoods: {
            score: 13,
            weekScore: [
              { date: weekDates[0], value: "1" },
              { date: weekDates[1], value: "1" },
              { date: weekDates[2], value: "2" },
              { date: weekDates[3], value: "2" },
              { date: weekDates[4], value: "3" },
              { date: weekDates[5], value: "1" },
              { date: weekDates[6], value: "3" }
            ]
          },
          highFodmapFoods: {
            score: 22,
            weekScore: [
              { date: weekDates[0], value: "2" },
              { date: weekDates[1], value: "2" },
              { date: weekDates[2], value: "3" },
              { date: weekDates[3], value: "3" },
              { date: weekDates[4], value: "4" },
              { date: weekDates[5], value: "5" },
              { date: weekDates[6], value: "3" }
            ]
          },
          processedFoods: {
            score: 29,
            weekScore: [
              { date: weekDates[0], value: "1" },
              { date: weekDates[1], value: "0" },
              { date: weekDates[2], value: "4" },
              { date: weekDates[3], value: "4" },
              { date: weekDates[4], value: "4" },
              { date: weekDates[5], value: "8" },
              { date: weekDates[6], value: "8" }
            ]
          }
        }
      },
      supplement: {
        summary: {},
        detailData: {}
      },
      fasting: {
        summary: {
          score: 16
        },
        detailData: {
          score: 977,
          targetHour: 16,
          weekScore: [
            {
              date: weekDates[0],
              startDateTime: `${this.getPreviousDate(weekDates[0])} 20:00:00`,
              endDateTime: `${weekDates[0]} 12:00:00`,
              value: "16",
              targetHour: 16,
              isCompleted: true
            },
            {
              date: weekDates[1],
              startDateTime: `${weekDates[0]} 19:00:00`,
              endDateTime: `${weekDates[1]} 12:00:00`,
              value: "17",
              targetHour: 16,
              isCompleted: true
            },
            {
              date: weekDates[2],
              startDateTime: `${weekDates[1]} 19:30:00`,
              endDateTime: `${weekDates[2]} 09:00:00`,
              value: "13.5",
              targetHour: 16,
              isCompleted: false
            },
            {
              date: weekDates[3],
              startDateTime: `${weekDates[2]} 18:00:00`,
              endDateTime: `${weekDates[3]} 12:00:00`,
              value: "18",
              targetHour: 16,
              isCompleted: true
            },
            {
              date: weekDates[4],
              startDateTime: `${weekDates[3]} 20:00:00`,
              endDateTime: `${weekDates[4]} 12:00:00`,
              value: "16",
              targetHour: 16,
              isCompleted: true
            },
            {
              date: weekDates[5],
              startDateTime: `${weekDates[4]} 18:30:00`,
              endDateTime: `${weekDates[5]} 12:00:00`,
              value: "17.5",
              targetHour: 16,
              isCompleted: true
            },
            {
              date: weekDates[6],
              startDateTime: `${weekDates[5]} 20:00:00`,
              endDateTime: `${weekDates[6]} 12:00:00`,
              value: "16",
              targetHour: 16,
              isCompleted: true
            }
          ]
        }
      },
      sleep: {
        summary: {
          score: 8
        },
        detailData: {
          score: 463,
          targetHour: 8,
          weekScore: [
            {
              date: weekDates[0],
              bedDateTime: `${this.getPreviousDate(weekDates[0])} 23:30:00`,
              wakeDateTime: `${weekDates[0]} 07:00:00`,
              value: "7.5",
              targetHour: 8,
              isCompleted: false
            },
            {
              date: weekDates[1],
              bedDateTime: `${weekDates[0]} 23:00:00`,
              wakeDateTime: `${weekDates[1]} 07:00:00`,
              value: "8",
              targetHour: 8,
              isCompleted: true
            },
            {
              date: weekDates[2],
              bedDateTime: `${weekDates[2]} 00:30:00`,
              wakeDateTime: `${weekDates[2]} 07:00:00`,
              value: "6.5",
              targetHour: 8,
              isCompleted: false
            },
            {
              date: weekDates[3],
              bedDateTime: `${weekDates[3]} 00:00:00`,
              wakeDateTime: `${weekDates[3]} 07:00:00`,
              value: "7",
              targetHour: 8,
              isCompleted: false
            },
            {
              date: weekDates[4],
              bedDateTime: `${weekDates[3]} 22:30:00`,
              wakeDateTime: `${weekDates[4]} 07:00:00`,
              value: "8.5",
              targetHour: 8,
              isCompleted: true
            },
            {
              date: weekDates[5],
              bedDateTime: `${weekDates[4]} 23:30:00`,
              wakeDateTime: `${weekDates[5]} 07:00:00`,
              value: "7.5",
              targetHour: 8,
              isCompleted: false
            },
            {
              date: weekDates[6],
              bedDateTime: `${weekDates[5]} 22:00:00`,
              wakeDateTime: `${weekDates[6]} 07:00:00`,
              value: "9",
              targetHour: 8,
              isCompleted: true
            }
          ]
        }
      },
      activity: {
        summary: {
          score: 1339
        },
        detailData: {
          score: 1339,
          complianceRate: 100,
          weekScore: [
            { date: weekDates[0], value: 500, hasRecord: true },
            { date: weekDates[1], value: 1030, hasRecord: true },
            { date: weekDates[2], value: 1235, hasRecord: true },
            { date: weekDates[3], value: 1405, hasRecord: true },
            { date: weekDates[4], value: 2200, hasRecord: true },
            { date: weekDates[5], value: 1470, hasRecord: true },
            { date: weekDates[6], value: 1530, hasRecord: true }
          ],
          weekActivity: [
            {
              date: weekDates[0],
              dayOfWeek: "월",
              activity: [
                { code: "WALKING", name: "걷기", calorie_burned: "140" },
                { code: "YOGA", name: "요가", calorie_burned: "210" },
                { code: "PILATES", name: "필라테스", calorie_burned: "150" }
              ]
            },
            {
              date: weekDates[1],
              dayOfWeek: "화",
              activity: [
                { code: "RUNNING", name: "달리기", calorie_burned: "400" },
                { code: "WEIGHT_TRAINING", name: "웨이트 트레이닝", calorie_burned: "630" }
              ]
            },
            {
              date: weekDates[2],
              dayOfWeek: "수",
              activity: [
                { code: "INDOOR_CYCLING", name: "실내 자전거", calorie_burned: "350" },
                { code: "SWIMMING", name: "수영", calorie_burned: "600" },
                { code: "WALKING", name: "걷기", calorie_burned: "105" },
                { code: "JUMP_ROPE", name: "줄넘기", calorie_burned: "180" }
              ]
            },
            {
              date: weekDates[3],
              dayOfWeek: "목",
              activity: [
                { code: "RUNNING", name: "달리기", calorie_burned: "300" },
                { code: "BODYWEIGHT_EXERCISE", name: "맨몸 운동 / 홈트", calorie_burned: "320" },
                { code: "WALKING", name: "걷기", calorie_burned: "70" },
                { code: "OUTDOOR_CYCLING", name: "야외 자전거", calorie_burned: "540" },
                { code: "YOGA", name: "요가", calorie_burned: "175" }
              ]
            },
            {
              date: weekDates[4],
              dayOfWeek: "금",
              activity: [
                { code: "BOXING", name: "복싱", calorie_burned: "660" },
                { code: "CLIMBING", name: "클라이밍", calorie_burned: "640" },
                { code: "HIKING", name: "등산 / 하이킹", calorie_burned: "900" }
              ]
            },
            {
              date: weekDates[5],
              dayOfWeek: "토",
              activity: [
                { code: "F45_CROSSFIT", name: "F45 / 크로스핏", calorie_burned: "660" },
                { code: "TENNIS_SQUASH", name: "테니스 / 스쿼시", calorie_burned: "810" }
              ]
            },
            {
              date: weekDates[6],
              dayOfWeek: "일",
              activity: [
                { code: "ZUMBA_GX", name: "줌바 / GX", calorie_burned: "400" },
                { code: "GOLF", name: "골프", calorie_burned: "750" },
                { code: "STAIR_CLIMBING", name: "계단 오르기", calorie_burned: "240" },
                { code: "WALKING", name: "걷기", calorie_burned: "140" }
              ]
            }
          ]
        }
      }
    };
  }

  /**
   * 이전 날짜 계산 헬퍼 함수
   */
  private getPreviousDate(dateString: string): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return formatKoreanDate(date);
  }

  /**
   * 당일 기록 제한 정보 조회 (통계용)
   * @param userId 사용자 ID
   * @param recordType 기록 타입
   * @returns { currentCount, maxCount }
   * @description 통계 API는 기간 데이터이므로 당일 기준으로 currentCount 계산
   */
  private async getTodayRecordLimit(userId: number, recordType: string): Promise<{ currentCount: number; maxCount: number }> {
    // 오늘 날짜 (KST)
    const today = getNowKST();
    const todayStr = formatKoreanDate(today);

    let currentCount: number;
    let maxCount: number;

    // SUPPLEMENT는 루틴에 등록된 영양제 개수를 currentCount로 사용
    if (recordType === 'SUPPLEMENT') {
      currentCount = await this.prisma.userSupplementRoutine.count({
        where: {
          userId,
          isActive: true,
        }
      });
      maxCount = 10; // 최대 10개
    } else {
      // 다른 타입들은 오늘 날짜의 기록 개수 조회
      currentCount = await this.prisma.userRecord.count({
        where: {
          userId,
          recordType,
          date: new Date(todayStr)
        }
      });

      // 기록 타입별 최대 기록 수
      switch (recordType) {
        case 'BEAUTY':
          maxCount = 1;
          break;
        case 'DIET':
          maxCount = 9; // 아침1+점심1+저녁1+간식3+야식3
          break;
        case 'FASTING':
          maxCount = 1;
          break;
        case 'SLEEP':
          maxCount = 1;
          break;
        case 'ACTIVITY':
          maxCount = 5;
          break;
        default:
          maxCount = -1;
      }
    }

    return {
      currentCount,
      maxCount
    };
  }

  // ========================================
  // 📊 NEWCOMER용 예시 통계 데이터 추출 헬퍼 함수들
  // ========================================

  /**
   * NEWCOMER용 예시 이너뷰티 통계 데이터 (getSampleStatisticsSummary에서 추출)
   */
  private getSampleBeautyStatistics(startDate: string, endDate: string): BeautyStatisticsDto {
    const sampleData = this.getSampleStatisticsSummary(startDate, endDate);
    return {
      ...sampleData.beauty,
      currentCount: 0,
      maxCount: 1
    };
  }

  /**
   * NEWCOMER용 예시 식단 통계 데이터 (getSampleStatisticsSummary에서 추출)
   */
  private getSampleDietStatistics(startDate: string, endDate: string): DietStatisticsDto {
    const sampleData = this.getSampleStatisticsSummary(startDate, endDate);
    return {
      ...sampleData.diet,
      currentCount: 0,
      maxCount: 9
    };
  }

  /**
   * NEWCOMER용 예시 영양제 통계 데이터
   */
  /**
   * NEWCOMER용 예시 영양제 통계 데이터
   */
  private getSampleSupplementStatistics(
    startDate: string,
    endDate: string,
  ): SupplementStatisticsDto {
    return {
      startDate,
      endDate,
      supplements: [],
      nutrients: [],
      currentCount: 0,
      maxCount: 10,
    };
  }

  /**
   * NEWCOMER용 예시 간헐적단식 통계 데이터 (getSampleStatisticsSummary에서 추출)
   */
  private getSampleFastingStatistics(startDate: string, endDate: string): FastingStatisticsDto {
    const sampleData = this.getSampleStatisticsSummary(startDate, endDate);
    return {
      ...sampleData.fasting,
      currentCount: 0,
      maxCount: 1
    };
  }

  /**
   * NEWCOMER용 예시 수면 통계 데이터 (getSampleStatisticsSummary에서 추출)
   */
  private getSampleSleepStatistics(startDate: string, endDate: string): SleepStatisticsDto {
    const sampleData = this.getSampleStatisticsSummary(startDate, endDate);
    return {
      ...sampleData.sleep,
      currentCount: 0,
      maxCount: 1
    };
  }

  /**
   * NEWCOMER용 예시 활동 통계 데이터 (getSampleStatisticsSummary에서 추출)
   */
  private getSampleActivityStatistics(startDate: string, endDate: string): ActivityStatisticsDto {
    const sampleData = this.getSampleStatisticsSummary(startDate, endDate);
    return {
      ...sampleData.activity,
      currentCount: 0,
      maxCount: 5
    };
  }

  // ========================================
  // 🤖 AI Agent 통계 API
  // ========================================

  /**
   * AI Agent용 통합 통계 데이터 조회
   *
   * @param chartId 결과지 ID (암호화된 토큰에서 복호화된 값)
   * @param days 조회 기간 (오늘 기준 N일 전부터 오늘까지, 기본값: 7)
   * @returns AI Agent가 분석에 필요한 모든 데이터
   *
   * 처리 순서:
   * 1. chartId로 userId 조회
   * 2. 외부 API(getIggLevels)로 음식물과민증 검사 결과 조회
   * 3. users 테이블에서 이름, 이너뷰티유형, AI코치유형, MBTI 조회
   * 4. user_records 테이블에서 자기선언문, 칭찬하기, 1일1미션 조회 (날짜 필터링)
   * 5. user_balance_game_histories 테이블에서 밸런스게임 이력 조회 (날짜 필터링)
   * 6. 6대 기록 데이터 조회 (뷰티, 식단, 영양제, 간헐적단식, 수면, 활동) (날짜 필터링)
   */
  async getAiAgentStatistics(chartId: string, days: number = 7): Promise<AiAgentStatisticsDto> {
    this.logger.log(`AI Agent 통계 조회 시작: chartId=${chartId}, days=${days}`);

    try {
      // 1. chartId로 userId 조회
      const userChart = await this.prisma.userChart.findUnique({
        where: { chartId }
      });

      if (!userChart) {
        throw new NotFoundException(`chartId에 해당하는 사용자를 찾을 수 없습니다: ${chartId}`);
      }

      const userId = userChart.userId;
      this.logger.log(`userId 조회 완료: ${userId}`);

      // 날짜 필터 계산 (오늘 기준 N일 전부터 오늘까지, KST 기준)
      const today = getNowKST();
      today.setHours(23, 59, 59, 999); // 오늘 23:59:59 (KST)

      const startDate = getNowKST();
      startDate.setDate(today.getDate() - (days - 1)); // days=7이면 오늘 포함 7일
      startDate.setHours(0, 0, 0, 0); // 시작일 00:00:00 (KST)

      this.logger.log(`날짜 필터 (KST): ${startDate.toISOString()} ~ ${today.toISOString()}`);

      // 2. 외부 API: 음식물과민증 검사 결과 조회
      let iggLevels = [];
      try {
        const iggResponse = await firstValueFrom(
          this.httpService.get(`https://sib.codns.com:3001/api/report/getIggLevels`, {
            params: { chartId },
            timeout: 10000 // 10초 타임아웃
          })
        );

        if (iggResponse.data && Array.isArray(iggResponse.data)) {
          iggLevels = iggResponse.data;
        }

        this.logger.log(`음식물과민증 검사 결과 조회 완료: ${iggLevels.length}건`);
      } catch (error) {
        this.logger.warn(`음식물과민증 검사 결과 조회 실패: ${error.message}`);
        // 실패해도 계속 진행 (빈 배열)
      }

      // 3. users 테이블: 이름, 이너뷰티유형, AI코치유형, MBTI 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          healthTypeAnimal: true, // 이너뷰티유형
          aiPersona: true,        // AI코치유형
        }
      });

      if (!user) {
        throw new NotFoundException(`사용자를 찾을 수 없습니다: userId=${userId}`);
      }

      const 이름 = user.name || '없음';
      const 이너뷰티유형 = user.healthTypeAnimal?.animalName || '없음';
      const AI코치유형 = user.aiPersona?.name || '없음';
      const MBTI = '없음'; // MBTI 필드는 아직 미구현

      this.logger.log(`사용자 정보 조회 완료: ${이름}, ${이너뷰티유형}, ${AI코치유형}`);

      // 4-1. 자기선언문, 칭찬하기 조회 (날짜 필터 없이 최신 1건)
      const declarationRecord = await this.prisma.userRecord.findFirst({
        where: {
          userId,
          recordType: 'DECLARATION'
        },
        orderBy: { createdAt: 'desc' }
      });

      const selfPraiseRecord = await this.prisma.userRecord.findFirst({
        where: {
          userId,
          recordType: 'SELF_PRAISE'
        },
        orderBy: { createdAt: 'desc' }
      });

      const 자기선언문 = (declarationRecord?.metadata as any)?.contents || '없음';
      const 칭찬하기 = (selfPraiseRecord?.metadata as any)?.contents || '없음';

      // 4-2. 1일1미션 조회 (날짜 필터링 적용)
      // 챌린지 일차 계산
      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: 'ACTIVE' // UserChallengeStatus.ACTIVE
        },
        select: { activatedAt: true }
      });

      let 챌린지일차 = 0;
      if (activeChallenge) {
        const { calculateChallengeDay } = await import('../../common/utils/kst-date.util');
        챌린지일차 = calculateChallengeDay(activeChallenge.activatedAt);
      }

      const missionRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'DAILY_MISSION',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const 수행한미션수 = missionRecords.length;

      const missions = {
        챌린지일차,
        수행한미션수,
        data: missionRecords.map(record => ({
          미션명: (record.metadata as any)?.missionTitle || (record.metadata as any)?.title || '없음',
          수행일시: record.createdAt.toISOString().replace('T', ' ').replace('Z', '')
        }))
      };

      this.logger.log(`미션 데이터 조회 완료: 자기선언문=${자기선언문 !== '없음'}, 칭찬하기=${칭찬하기 !== '없음'}, 챌린지일차=${챌린지일차}, 수행한미션수=${수행한미션수}`);

      // 5. user_balance_game_histories: 밸런스게임 이력 조회 (날짜 필터링)
      const balanceGameHistories = await this.prisma.userBalanceGameHistory.findMany({
        where: {
          userId,
          playDate: {
            gte: startDate,
            lte: today
          }
        },
        include: {
          game: true // 밸런스게임 마스터 정보 포함
        },
        orderBy: { playDate: 'asc' }
      });

      // 밸런스게임 응답 생성 (step 1의 선택만 의미있음)
      const 밸런스게임: Array<{
        title: string;
        description: string;
        option: string;
        keyword: string;
        linkedProduct: string;
        createdAt: string;
      }> = [];

      for (const history of balanceGameHistories) {
        const options = history.selectedOptions as Array<{ step: number; option: number }>;
        if (!Array.isArray(options) || options.length === 0) continue;

        // step 1의 선택만 사용
        const step1 = options.find(opt => opt.step === 1);
        if (!step1) continue;

        const game = history.game;
        const selectedOption = step1.option; // 1 또는 2

        // 선택한 옵션에 따라 텍스트/키워드/연결제품 추출
        const optionText = selectedOption === 1 ? game.option1Text : game.option2Text;
        const keyword = selectedOption === 1 ? game.option1Keyword : game.option2Keyword;
        const linkedProduct = selectedOption === 1 ? game.option1LinkedProduct : game.option2LinkedProduct;

        밸런스게임.push({
          title: game.title,
          description: game.description || '',
          option: optionText || '',
          keyword: keyword || '',
          linkedProduct: linkedProduct || '',
          createdAt: history.completedAt.toISOString()
        });
      }

      this.logger.log(`밸런스게임 이력 조회 완료: ${밸런스게임.length}건`);

      // 6. 6대 기록 데이터 조회 (날짜 필터링)
      // 6-1. 뷰티 기록
      const beautyRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'BEAUTY',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      const 뷰티 = beautyRecords.map(record => {
        const metadata = record.metadata as any || {};
        const innerBeauty = metadata.innerBeauty || [];
        const outerBeauty = metadata.outerBeauty || [];

        const innerBeautyScore = innerBeauty.reduce((sum: number, item: any) => sum + (item.score || 0), 0);
        const outerBeautyScore = outerBeauty.reduce((sum: number, item: any) => sum + (item.score || 0), 0);

        return {
          date: formatKoreanDate(record.date),
          totalScore: innerBeautyScore + outerBeautyScore,
          innerBeautyScore,
          outerBeautyScore,
          innerBeauty: innerBeauty.map((item: any) => ({ no: item.no, score: item.score })),
          outerBeauty: outerBeauty.map((item: any) => ({ no: item.no, score: item.score }))
        };
      });

      // 6-2. 식단 기록
      const dietRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'DIET',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      const 식단 = dietRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: formatKoreanDate(record.date),
          diet: metadata.diet || 'UNKNOWN',
          foodName: metadata.foodName || null,
          imageUrl: record.imageUrl || null,
          isFasting: metadata.isFasting || false,
          allergyFoods: metadata.allergyFoods || [],
          allergyScore: metadata.allergyScore || 0,
          processedCount: metadata.processedCount || 0,
          processedFoods: metadata.processedFoods || [],
          highFodmapCount: metadata.highFodmapCount || 0,
          highFodmapFoods: metadata.highFodmapFoods || []
        };
      });

      // 6-3. 영양제 기록 (일별 제품별)
      const supplementRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      // productId 수집
      const productIds = new Set<number>();
      supplementRecords.forEach(record => {
        const metadata = record.metadata as any || {};
        if (metadata?.productId) {
          productIds.add(metadata.productId);
        }
      });

      let 영양제 = [];

      if (productIds.size > 0) {
        // 제품 정보 조회
        const products = await this.prisma.product.findMany({
          where: { id: { in: Array.from(productIds) } },
          select: {
            id: true,
            name: true,
            productInfo: true
          }
        });

        // 영양소 조회
        const supplementNutrients = await this.prisma.supplementNutrient.findMany({
          where: { productId: { in: Array.from(productIds) } },
          select: {
            productId: true,
            nutrientName: true
          }
        });

        // productId별 영양소 그룹화
        const nutrientsByProduct = new Map<number, string[]>();
        supplementNutrients.forEach(sn => {
          if (!nutrientsByProduct.has(sn.productId)) {
            nutrientsByProduct.set(sn.productId, []);
          }
          nutrientsByProduct.get(sn.productId)!.push(sn.nutrientName);
        });

        // productId -> product 매핑
        const productMap = new Map(products.map(p => [p.id, p]));

        // 일별-제품별로 펼치기
        영양제 = supplementRecords.map(record => {
          const metadata = record.metadata as any || {};
          const productId = metadata?.productId;

          if (!productId) return null;

          const product = productMap.get(productId) as any;
          if (!product) return null;

          const frequencyPerDay = product.productInfo?.['frequency_per_day'] || 1;

          // 하루 섭취 횟수 계산
          let dailyIntake = 0;
          if (metadata.morning) dailyIntake++;
          if (metadata.afternoon) dailyIntake++;
          if (metadata.evening) dailyIntake++;

          return {
            date: formatKoreanDate(record.date),
            productName: product.name,
            intakeCount: dailyIntake,
            recommendedCount: frequencyPerDay,
            nutrients: nutrientsByProduct.get(product.id) || []
          };
        }).filter(item => item !== null);
      }

      // 6-4. 간헐적단식 기록
      const fastingRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'FASTING',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      const 간헐적단식 = fastingRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: formatKoreanDate(record.date),
          startDateTime: metadata.startDateTime || '',
          endDateTime: metadata.endDateTime || '',
          fastingHours: metadata.fastingHours || 0
        };
      });

      // 6-5. 수면 기록
      const sleepRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SLEEP',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      const 수면 = sleepRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: formatKoreanDate(record.date),
          bedDateTime: metadata.bedDateTime || '',
          wakeDateTime: metadata.wakeDateTime || '',
          sleepHours: metadata.sleepHours || 0
        };
      });

      // 6-6. 활동 기록
      const activityRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'ACTIVITY',
          date: {
            gte: startDate,
            lte: today
          }
        },
        orderBy: { date: 'asc' }
      });

      const 활동 = activityRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: formatKoreanDate(record.date),
          imageUrl: record.imageUrl || null,
          activityTime: metadata.activityTime || '00:00:00',
          activityType: {
            code: metadata.activityType?.code || 'UNKNOWN',
            name: metadata.activityType?.name || '알 수 없음',
            base_minutes: metadata.activityType?.base_minutes || 0,
            calorie_rate: metadata.activityType?.calorie_rate || 0
          },
          totalDuration: metadata.totalDuration || 0,
          durationInMinutes: metadata.durationInMinutes || 0,
          estimatedCalories: metadata.estimatedCalories || 0
        };
      });

      this.logger.log(`6대 기록 조회 완료: 뷰티=${뷰티.length}, 식단=${식단.length}, 단식=${간헐적단식.length}, 수면=${수면.length}, 활동=${활동.length}`);

      // 최종 응답 생성
      return {
        음식물과민증검사결과: iggLevels,
        이름,
        이너뷰티유형,
        AI코치유형,
        MBTI,
        자기선언문,
        칭찬하기,
        '1일1미션': missions,
        밸런스게임,
        뷰티,
        식단,
        영양제,
        간헐적단식,
        수면,
        활동
      };

    } catch (error) {
      this.logger.error(`AI Agent 통계 조회 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * AI Agent 경량화 통계 조회
   * - 1차 API의 데이터를 배열 기반으로 경량화
   * - 스키마 정보 포함하여 배열 구조 설명
   * - 한글 key는 1차 API와 동일하게 유지
   */
  async getAiAgentStatisticsMinified(chartId: string, days: number = 7): Promise<any> {
    this.logger.log(`AI Agent 경량화 통계 조회 시작: chartId=${chartId}, days=${days}`);

    try {
      // 1차 API와 동일한 데이터 조회
      const rawData = await this.getAiAgentStatistics(chartId, days);

      // 스키마 정의
      const _schema = {
        version: "2.0",
        description: "정규화된 사용자 건강 데이터",
        notes: {
          "1일1미션": {
            data: "[미션명, 수행일시]"
          },
          밸런스게임: "[title, description, option, keyword, linkedProduct, createdAt]",
          뷰티: "[totalScore, innerScore, outerScore, [inner1,inner2,inner3,inner4], [outer1,outer2,outer3,outer4]]",
          식단: {
            "MEAL_TYPE": "[foodName, isFasting, [allergyFoods], allergyScore, [processedFoods], processedCount, [highFodmapFoods], highFodmapCount]"
          },
          영양제: {
            "PRODUCT_NAME": {
              "YYYY-MM-DD": "[intakeCount, recommendedCount]"
            }
          },
          간헐적단식: "[startDateTime, endDateTime, fastingHours]",
          수면: "[bedDateTime, wakeDateTime, sleepHours]",
          활동: {
            activityTypes: "[name, baseMinutes, calorieRate]",
            data: "[activityTime, typeCode, durationMinutes, estimatedCalories]"
          }
        }
      };

      // 음식물과민증검사결과 경량화 (레벨별 배열로 변환)
      const 음식물과민증검사결과: any = {};
      if (rawData.음식물과민증검사결과 && rawData.음식물과민증검사결과.length > 0) {
        const item = rawData.음식물과민증검사결과[0];

        // level1~5 문자열을 배열로 변환
        음식물과민증검사결과["1"] = item.level1 ? item.level1.split(',').map((s: string) => s.trim()) : [];
        음식물과민증검사결과["2"] = item.level2 ? item.level2.split(',').map((s: string) => s.trim()) : [];
        음식물과민증검사결과["3"] = item.level3 ? item.level3.split(',').map((s: string) => s.trim()) : [];
        음식물과민증검사결과["4"] = item.level4 ? item.level4.split(',').map((s: string) => s.trim()) : [];
        음식물과민증검사결과["5"] = item.level5 ? item.level5.split(',').map((s: string) => s.trim()) : [];
      }

      // 1일1미션 경량화
      const 미션 = {
        챌린지일차: rawData['1일1미션'].챌린지일차,
        수행한미션수: rawData['1일1미션'].수행한미션수,
        data: rawData['1일1미션'].data.map((m: any) => [
          m.미션명,
          m.수행일시
        ])
      };

      // 밸런스게임 경량화
      const 밸런스게임 = rawData.밸런스게임.map((bg: any) => [
        bg.title,
        bg.description,
        bg.option,
        bg.keyword,
        bg.linkedProduct,
        bg.createdAt
      ]);

      // 뷰티 경량화 (날짜별로 그룹핑)
      const 뷰티Map = new Map<string, any[]>();
      rawData.뷰티.forEach((b: any) => {
        const 뷰티데이터 = [
          b.totalScore,
          b.innerBeautyScore,
          b.outerBeautyScore,
          b.innerBeauty.map((ib: any) => ib.score),
          b.outerBeauty.map((ob: any) => ob.score)
        ];

        if (!뷰티Map.has(b.date)) {
          뷰티Map.set(b.date, []);
        }
        뷰티Map.get(b.date)!.push(뷰티데이터);
      });

      const 뷰티 = Object.fromEntries(
        Array.from(뷰티Map.entries()).map(([date, records]) => {
          return [date, records.length === 1 ? records[0] : records];
        })
      );

      // 식단 경량화 (날짜별 > 식사타입별)
      const 식단Map = new Map<string, any>();
      rawData.식단.forEach((d: any) => {
        if (!식단Map.has(d.date)) {
          식단Map.set(d.date, {});
        }

        const allergyNames = d.allergyFoods.map((af: any) => af.name);

        식단Map.get(d.date)![d.diet] = [
          d.foodName,
          d.isFasting,
          allergyNames,
          d.allergyScore,
          d.processedFoods,
          d.processedCount,
          d.highFodmapFoods,
          d.highFodmapCount
        ];
      });

      const 식단 = Object.fromEntries(식단Map.entries());

      // 영양제 경량화 (제품명별 > 날짜별)
      const 영양제Map = new Map<string, any>();
      rawData.영양제.forEach((s: any) => {
        if (!영양제Map.has(s.productName)) {
          영양제Map.set(s.productName, {});
        }
        영양제Map.get(s.productName)![s.date] = [
          s.intakeCount,
          s.recommendedCount
        ];
      });

      const 영양제 = Object.fromEntries(영양제Map.entries());

      // 간헐적단식 경량화 (날짜별)
      const 간헐적단식Map = new Map<string, any>();
      rawData.간헐적단식.forEach((f: any) => {
        간헐적단식Map.set(f.date, [
          f.startDateTime,
          f.endDateTime,
          f.fastingHours
        ]);
      });

      const 간헐적단식 = Object.fromEntries(간헐적단식Map.entries());

      // 수면 경량화 (날짜별)
      const 수면Map = new Map<string, any>();
      rawData.수면.forEach((sl: any) => {
        수면Map.set(sl.date, [
          sl.bedDateTime,
          sl.wakeDateTime,
          sl.sleepHours
        ]);
      });

      const 수면 = Object.fromEntries(수면Map.entries());

      // 활동 경량화
      // 1. activityTypes 추출 (중복 제거)
      const activityTypesMap = new Map<string, any>();
      rawData.활동.forEach((a: any) => {
        const code = a.activityType.code;
        if (!activityTypesMap.has(code)) {
          activityTypesMap.set(code, [
            a.activityType.name,
            a.activityType.base_minutes,
            a.activityType.calorie_rate
          ]);
        }
      });

      const activityTypes = Object.fromEntries(activityTypesMap.entries());

      // 2. 활동 데이터 (날짜별)
      const 활동Map = new Map<string, any[]>();
      rawData.활동.forEach((a: any) => {
        if (!활동Map.has(a.date)) {
          활동Map.set(a.date, []);
        }
        활동Map.get(a.date)!.push([
          a.activityTime,
          a.activityType.code,
          a.durationInMinutes,
          a.estimatedCalories
        ]);
      });

      const 활동데이터 = Object.fromEntries(활동Map.entries());

      // 최종 응답 생성
      return {
        _schema,
        음식물과민증검사결과,
        이름: rawData.이름,
        이너뷰티유형: rawData.이너뷰티유형,
        AI코치유형: rawData.AI코치유형,
        MBTI: rawData.MBTI,
        자기선언문: rawData.자기선언문,
        칭찬하기: rawData.칭찬하기,
        '1일1미션': 미션,
        밸런스게임,
        뷰티,
        식단,
        영양제,
        간헐적단식,
        수면,
        활동: {
          activityTypes,
          data: 활동데이터
        }
      };

    } catch (error) {
      this.logger.error(`AI Agent 경량화 통계 조회 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

}