import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import { getDayOfWeek } from '../../common/utils/korea-date.util';
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
      startDate: startDate.toISOString().split('T')[0],
      endDate: yesterday.toISOString().split('T')[0]
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
      startDate: previousWeekStart.toISOString().split('T')[0],
      endDate: previousWeekEnd.toISOString().split('T')[0]
    };
  }

  /**
   * 7일간 날짜 배열 생성
   */
  private generateWeekDates(startDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 7; i++) {
      dates.push(current.toISOString().split('T')[0]);
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
        const recordDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
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
          const recordDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
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
  async getSupplementStatistics(userId: number, isNewcomer: boolean = false): Promise<SupplementStatisticsDto> {
    try {
      this.logger.log(`영양제 통계 조회 시작 - 사용자: ${userId}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 영양제 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleSupplementStatistics();
      }

      const { startDate, endDate } = this.getWeekDateRange();

      // 1주일간 영양제 기록 조회
      const supplementRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      });

      console.log(`🔥 영양제 쿼리 조건 - userId: ${userId}, startDate: ${startDate}, endDate: ${endDate}`);
      console.log(`🔥 영양제 조회 결과: ${JSON.stringify(supplementRecords, null, 2)}`);

      const weekDates = this.generateWeekDates(startDate);
      const weeklySupplements = [];
      let takenDays = 0;

      // 일별 데이터 생성 (개선된 구조)
      weekDates.forEach(date => {
        const records = supplementRecords.filter(r => r.date === date);

        let allTakenSupplements: string[] = [];

        if (records.length > 0) {
          // 같은 날짜의 모든 기록을 처리
          records.forEach(record => {
            if (record.metadata && record.metadata.supplements) {
              // 섭취한 영양제만 필터링
              const takenSupplements = record.metadata.supplements
                .filter((supplement: any) => supplement.taken)
                .map((supplement: any) => supplement.name);

              allTakenSupplements = [...allTakenSupplements, ...takenSupplements];
            }
          });

          weeklySupplements.push({
            date,
            supplements: allTakenSupplements,
            taken: allTakenSupplements.length
          });

          if (allTakenSupplements.length > 0) {
            takenDays++;
          }
        } else {
          weeklySupplements.push({
            date,
            supplements: [],
            taken: 0
          });
        }
      });

      // 준수율 계산 (소수점 반올림)
      const complianceRate = Math.round((takenDays / 7) * 100);

      this.logger.log(`영양제 통계 조회 완료 - 사용자: ${userId}, 준수율: ${complianceRate}%`);

      // 당일 기록 제한 정보 계산 (오늘 날짜 기준)
      const recordLimit = await this.getTodayRecordLimit(userId, 'SUPPLEMENT');

      return {
        weeklySupplements,
        summary: {
          score: complianceRate
        },
        currentCount: recordLimit.currentCount,
        maxCount: recordLimit.maxCount
        // TODO: nutritionAnalysis 영양소 정보 기록 시스템 구축 후 활성화
      };
    } catch (error) {
      this.logger.error(`영양제 통계 조회 실패 - 사용자: ${userId}`, error);
      throw error;
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
          const recordDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
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
          const recordDate = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
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
          const recordDate = new Date(r.date).toISOString().split('T')[0];
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
      this.logger.log(`통계 목록 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}, NEWCOMER: ${isNewcomer}`);

      // NEWCOMER는 예시 데이터 반환
      if (isNewcomer) {
        this.logger.log(`예시 통계 데이터 생성 - 사용자: ${userId}`);
        return this.getSampleStatisticsSummary(startDate, endDate);
      }

      // 각 통계 조회 (병렬 처리) - 완성된 5개 통계 API 응답을 그대로 묶어서 반환
      const [beauty, diet, fasting, sleep, activity] = await Promise.all([
        this.getBeautyStatistics(userId, startDate, endDate),
        this.getDietStatistics(userId, startDate, endDate),
        this.getFastingStatistics(userId, startDate, endDate),
        this.getSleepStatistics(userId, startDate, endDate),
        this.getActivityStatistics(userId, startDate, endDate)
      ]);

      // comment, totalComment 제거 처리
      const cleanedBeauty = this.removeComments(beauty);
      const cleanedDiet = this.removeComments(diet);
      const cleanedFasting = this.removeComments(fasting);
      const cleanedSleep = this.removeComments(sleep);
      const cleanedActivity = this.removeComments(activity);

      this.logger.log(`통계 목록 조회 완료 - 사용자: ${userId}`);

      // 5개 통계 응답을 그대로 반환 (프론트엔드에서 알아서 처리)
      return {
        dateRange: { startDate, endDate },
        beauty: cleanedBeauty,
        diet: cleanedDiet,
        supplement: { summary: {}, detailData: {} }, // 영양제 기획 미확정
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
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
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
    const todayStr = today.toISOString().split('T')[0];

    // 오늘 날짜의 기록 개수 조회
    const todayRecordCount = await this.prisma.userRecord.count({
      where: {
        userId,
        recordType,
        date: new Date(todayStr)
      }
    });

    // 기록 타입별 최대 기록 수
    let maxCount: number;
    switch (recordType) {
      case 'BEAUTY':
        maxCount = 1;
        break;
      case 'DIET':
        maxCount = 9; // 아침1+점심1+저녁1+간식3+야식3
        break;
      case 'SUPPLEMENT':
        maxCount = -1; // 무제한
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

    return {
      currentCount: todayRecordCount,
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
  private getSampleSupplementStatistics(): SupplementStatisticsDto {
    const { startDate, endDate } = this.getWeekDateRange();
    const weekDates = this.generateWeekDates(startDate);

    return {
      weeklySupplements: weekDates.map(date => ({
        date,
        supplements: [],
        taken: 0
      })),
      summary: {
        score: 0
      },
      currentCount: 0,
      maxCount: -1
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
   * @returns AI Agent가 분석에 필요한 모든 데이터
   *
   * 처리 순서:
   * 1. chartId로 userId 조회
   * 2. 외부 API(getIggLevels)로 음식물과민증 검사 결과 조회
   * 3. users 테이블에서 이름, 이너뷰티유형, AI코치유형, MBTI 조회
   * 4. user_records 테이블에서 자기선언문, 칭찬하기, 1일1미션 조회
   * 5. user_balance_game_histories 테이블에서 밸런스게임 이력 조회
   * 6. 6대 기록 데이터 조회 (뷰티, 식단, 영양제, 간헐적단식, 수면, 활동)
   */
  async getAiAgentStatistics(chartId: string): Promise<AiAgentStatisticsDto> {
    this.logger.log(`AI Agent 통계 조회 시작: chartId=${chartId}`);

    try {
      // 1. chartId로 userId 조회
      const userChart = await this.prisma.userChart.findUnique({
        where: { chartId }
      });

      if (!userChart) {
        throw new Error(`chartId에 해당하는 사용자를 찾을 수 없습니다: ${chartId}`);
      }

      const userId = userChart.userId;
      this.logger.log(`userId 조회 완료: ${userId}`);

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
        throw new Error(`사용자를 찾을 수 없습니다: userId=${userId}`);
      }

      const 이름 = user.name || '없음';
      const 이너뷰티유형 = user.healthTypeAnimal?.animalName || '없음';
      const AI코치유형 = user.aiPersona?.name || '없음';
      const MBTI = '없음'; // MBTI 필드는 아직 미구현

      this.logger.log(`사용자 정보 조회 완료: ${이름}, ${이너뷰티유형}, ${AI코치유형}`);

      // 4. user_records: 자기선언문, 칭찬하기, 1일1미션 조회
      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: { in: ['DECLARATION', 'SELF_PRAISE', 'DAILY_MISSION'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      let 자기선언문 = '없음';
      let 칭찬하기 = '없음';
      const missions: string[] = [];

      for (const record of records) {
        if (record.recordType === 'DECLARATION') {
          자기선언문 = (record.metadata as any)?.contents || '없음';
        } else if (record.recordType === 'SELF_PRAISE') {
          칭찬하기 = (record.metadata as any)?.contents || '없음';
        } else if (record.recordType === 'DAILY_MISSION') {
          const mission = (record.metadata as any)?.missionTitle || (record.metadata as any)?.title;
          if (mission) {
            missions.push(mission);
          }
        }
      }

      this.logger.log(`미션 데이터 조회 완료: 자기선언문=${자기선언문 !== '없음'}, 칭찬하기=${칭찬하기 !== '없음'}, 미션=${missions.length}건`);

      // 5. user_balance_game_histories: 밸런스게임 이력 조회
      const balanceGameHistories = await this.prisma.userBalanceGameHistory.findMany({
        where: { userId },
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

      // 6. 6대 기록 데이터 조회
      // 6-1. 뷰티 기록
      const beautyRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'BEAUTY'
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
          date: record.date.toISOString().split('T')[0],
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
          recordType: 'DIET'
        },
        orderBy: { date: 'asc' }
      });

      const 식단 = dietRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: record.date.toISOString().split('T')[0],
          diet: metadata.dietType || 'UNKNOWN',
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

      // 6-3. 영양제 기록 (현재는 "없음"으로 고정)
      const 영양제 = '없음';

      // 6-4. 간헐적단식 기록
      const fastingRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'FASTING'
        },
        orderBy: { date: 'asc' }
      });

      const 간헐적단식 = fastingRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: record.date.toISOString().split('T')[0],
          startDateTime: metadata.startDateTime || '',
          endDateTime: metadata.endDateTime || '',
          fastingHours: metadata.fastingHours || 0
        };
      });

      // 6-5. 수면 기록
      const sleepRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SLEEP'
        },
        orderBy: { date: 'asc' }
      });

      const 수면 = sleepRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: record.date.toISOString().split('T')[0],
          bedDateTime: metadata.bedDateTime || '',
          wakeDateTime: metadata.wakeDateTime || '',
          sleepHours: metadata.sleepHours || 0
        };
      });

      // 6-6. 활동 기록
      const activityRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'ACTIVITY'
        },
        orderBy: { date: 'asc' }
      });

      const 활동 = activityRecords.map(record => {
        const metadata = record.metadata as any || {};
        return {
          date: record.date.toISOString().split('T')[0],
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

}