import { Injectable, Logger } from '@nestjs/common';
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
  async getBeautyStatistics(userId: number, startDate: string, endDate: string): Promise<BeautyStatisticsDto> {
    try {
      this.logger.log(`이너뷰티 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

      // 이전 주 날짜 계산 (제공된 날짜 기준으로 -7일)
      const currentStartDate = new Date(startDate);
      const prevStartDate = new Date(currentStartDate);
      prevStartDate.setDate(currentStartDate.getDate() - 7);

      const currentEndDate = new Date(endDate);
      const prevEndDate = new Date(currentEndDate);
      prevEndDate.setDate(currentEndDate.getDate() - 7);

      const prevStartDateStr = prevStartDate.toISOString().split('T')[0];
      const prevEndDateStr = prevEndDate.toISOString().split('T')[0];

      // 이번 주 뷰티 기록 조회
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

      // 이전 주 뷰티 기록 조회 (비교용)
      const previousWeekRecords = await this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'BEAUTY',
          date: {
            gte: new Date(prevStartDateStr),
            lte: new Date(prevEndDateStr)
          }
        },
        orderBy: { date: 'asc' }
      });

      const weekDates = this.generateWeekDates(startDate);
      const prevWeekDates = this.generateWeekDates(prevStartDateStr);

      // 이번 주 데이터 분석
      const currentWeekAnalysis = this.analyzeBeautyDataForCorrectStructure(currentWeekRecords, weekDates);

      // 이전 주 데이터 분석 (비교용)
      const previousWeekAnalysis = this.analyzeBeautyDataForCorrectStructure(previousWeekRecords, prevWeekDates);

      // 전주 대비 차이 계산
      const summaryPrevWeekDiff = currentWeekAnalysis.summaryScore - previousWeekAnalysis.summaryScore;
      const innerPrevWeekDiff = currentWeekAnalysis.innerScore - previousWeekAnalysis.innerScore;
      const outerPrevWeekDiff = currentWeekAnalysis.outerScore - previousWeekAnalysis.outerScore;

      this.logger.log(`이너뷰티 통계 조회 완료 - 사용자: ${userId}, 종합점수: ${currentWeekAnalysis.summaryScore}`);

      // 형님이 정확히 요청한 데이터셋 구조
      return {
        summary: {
          score: currentWeekAnalysis.summaryScore,
          prevWeekDiff: summaryPrevWeekDiff,
          weekScore: currentWeekAnalysis.summaryWeekScore,
          comment: "평균점수를 룰베이스에 대입해서 멘트 보여줌. ex)평균점수가50점이면 50점에 해당하는 메세지 노출. 일단 여긴 하드코딩한다."
        },
        detailData: {
          innerBeauty: {
            score: currentWeekAnalysis.innerScore,
            prevWeekDiff: innerPrevWeekDiff,
            weekScore: currentWeekAnalysis.innerWeekScore,
            answer: currentWeekAnalysis.innerAnswers
          },
          outerBeauty: {
            score: currentWeekAnalysis.outerScore,
            prevWeekDiff: outerPrevWeekDiff,
            weekScore: currentWeekAnalysis.outerWeekScore,
            answer: currentWeekAnalysis.outerAnswers
          },
          totalComment: "평균점수, 이너뷰티점수, 아우터뷰티점수를 룰베이스에 대입해서 멘트 보여줌. 마찬가지로 일단 여긴 하드코딩한다."
        }
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
  async getDietStatistics(userId: number, startDate: string, endDate: string): Promise<DietStatisticsDto> {
    try {
      this.logger.log(`식단 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

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

      // 형님이 정확히 요청한 데이터셋 구조
      return {
        summary: {
          score: summaryScore,
          comment: "점수를 룰베이스에 대입해서 멘트 보여줌. ex)평균점수가50점이면 50점에 해당하는 메세지 노출. 일단 여긴 하드코딩한다."
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
          },
          totalComment: "평균점수, 과민식품섭취횟수, 고포드맵섭취횟수를 룰베이스에 대입해서 멘트 보여줌. 마찬가지로 일단 여긴 하드코딩한다."
        }
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
  async getSupplementStatistics(userId: number): Promise<SupplementStatisticsDto> {
    try {
      this.logger.log(`영양제 통계 조회 시작 - 사용자: ${userId}`);
      
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

      return {
        weeklySupplements,
        summary: {
          score: complianceRate,
          comment: '점수를 룰베이스에 대입해서 멘트 보여줌. ex)준수율이 80%이면 80%에 해당하는 메세지 노출. 일단 여긴 하드코딩한다.'
        }
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
  async getFastingStatistics(userId: number, startDate: string, endDate: string): Promise<FastingStatisticsDto> {
    try {
      this.logger.log(`간헐적단식 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

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
          isCompleted
        };
      });

      // 평균 단식시간 계산
      const totalHours = weekScore.reduce((sum, item) => sum + parseFloat(item.value), 0);
      const daysCount = weekDates.length;
      const averageScore = daysCount > 0 ? Math.round(totalHours / daysCount) : 0;

      // 달성률 계산 (완료된 날 / 전체 날)
      const completedDays = weekScore.filter(item => item.isCompleted).length;
      const achievementScore = daysCount > 0 ? Math.round((completedDays / daysCount) * 100) : 0;

      const summary = {
        score: averageScore,
        comment: '점수를 룰베이스에 대입해서 멘트 보여줌. ex)평균점수가50점이면 50점에 해당하는 메세지 노출. 일단 여긴 하드코딩한다.'
      };

      const detailData = {
        score: achievementScore,
        weekScore,
        totalComment: '평균단식시간(점수)를 룰베이스에 대입해서 멘트 보여줌. 마찬가지로 일단 여긴 하드코딩한다.'
      };

      this.logger.log(`간헐적단식 통계 조회 완료 - 사용자: ${userId}, 평균: ${averageScore}시간, 달성률: ${achievementScore}%`);

      return {
        summary,
        detailData
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
  async getSleepStatistics(userId: number, startDate: string, endDate: string): Promise<SleepStatisticsDto> {
    try {
      this.logger.log(`수면 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

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
          isCompleted
        };
      });

      // 평균 수면 점수 계산 (평균 수면시간)
      const totalHours = weekScore.reduce((sum, item) => sum + parseFloat(item.value), 0);
      const daysCount = weekDates.length;
      const averageScore = daysCount > 0 ? Math.round(totalHours / daysCount) : 0;

      // 달성률 계산 (완료된 날 / 전체 날)
      const completedDays = weekScore.filter(item => item.isCompleted).length;
      const achievementScore = daysCount > 0 ? Math.round((completedDays / daysCount) * 100) : 0;

      const summary = {
        score: averageScore,
        comment: '점수를 룰베이스에 대입해서 멘트 보여줌. ex)평균점수가50점이면 50점에 해당하는 메세지 노출. 일단 여긴 하드코딩한다.'
      };

      const detailData = {
        score: achievementScore,
        weekScore,
        totalComment: '평균수면시간(점수)를 룰베이스에 대입해서 멘트 보여줌. 마찬가지로 일단 여긴 하드코딩한다.'
      };

      this.logger.log(`수면 통계 조회 완료 - 사용자: ${userId}, 평균: ${averageScore}시간, 달성률: ${achievementScore}%`);

      return {
        summary,
        detailData
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
  async getActivityStatistics(userId: number, startDate: string, endDate: string): Promise<ActivityStatisticsDto> {
    try {
      this.logger.log(`활동 통계 조회 시작 - 사용자: ${userId}, 기간: ${startDate} ~ ${endDate}`);

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

      return {
        summary: {
          score: weekAverageScore,
          comment: '점수를 룰베이스에 대입해서 멘트 보여줌. ex)평균점수가50점이면 50점에 해당하는 메세지 노출. 일단 여긴 하드코딩한다.'
        },
        detailData: {
          score: weekAverageScore,
          complianceRate,
          weekScore,
          weekActivity,
          totalComment: '평균칼로리(점수)를 룰베이스에 대입해서 멘트 보여줌. 마찬가지로 일단 여긴 하드코딩한다.'
        }
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
   */
  async getStatisticsSummary(userId: number): Promise<StatisticsSummaryDto> {
    try {
      this.logger.log(`통계 목록 조회 시작 - 사용자: ${userId}`);
      
      const { startDate, endDate } = this.getWeekDateRange();
      
      // 각 통계 조회 (병렬 처리)
      const [
        beautyStats,
        dietStats,
        supplementStats,
        fastingStats,
        sleepStats,
        activityStats
      ] = await Promise.all([
        this.getBeautyStatistics(userId, startDate, endDate),
        this.getDietStatistics(userId, startDate, endDate),
        this.getSupplementStatistics(userId),
        this.getFastingStatistics(userId, startDate, endDate),
        this.getSleepStatistics(userId, startDate, endDate),
        this.getActivityStatistics(userId, startDate, endDate)
      ]);

      // 요약 카드 생성
      // 요약 카드 생성
      const summaryCards: StatisticsSummaryCard[] = [
        {
          type: 'BEAUTY',
          score: beautyStats.summary.score,
          weeklyData: beautyStats.summary.weekScore,
          innerBeauty: beautyStats.detailData.innerBeauty,
          outerBeauty: beautyStats.detailData.outerBeauty,
          // weeklyData: beautyStats.summary.weekScore.map(s => parseInt(s.value))
        },
        {
          type: 'DIET',
          allergyFoods: dietStats.detailData.allergyFoods,
          healthFoods: dietStats.detailData.healthFoods,
          processedFoods: dietStats.detailData.processedFoods,
          status: dietStats.summary.score > 50 ? '좋음' : '주의',
          // weeklyData: dietStats.detailData.allergyFoods.weekScore.map(d => parseInt(d.value))
          // status: dietStats.summary.score > 50 ? '좋음' : '주의',
          // weeklyData: dietStats.detailData.allergyFoods.weekScore.map(d => parseInt(d.value))
        },
        {
          type: 'SUPPLEMENT',
          score: supplementStats.summary.score,
          weeklyData: supplementStats.weeklySupplements,
          // status: supplementStats.summary.score > 50 ? '좋음' : '주의',
          // unit: '%',
          // status: '준수',
          // weeklyData: supplementStats.weeklySupplements.map(s => s.taken)
          // unit: '%',
          // status: '준수',
          // weeklyData: supplementStats.weeklySupplements.map(s => s.taken)
        },
        {
          type: 'FASTING',
          score: fastingStats.summary.score,
          weeklyData: fastingStats.detailData.weekScore,
          // weeklyData: fastingStats.detailData.weekScore.map(d => parseFloat(d.value))
        },
        {
          type: 'SLEEP',
          score: sleepStats.summary.score,
          weeklyData: sleepStats.detailData.weekScore,
          // unit: '시간',
          // status: '평균',
          // weeklyData: sleepStats.detailData.weekScore.map(d => parseFloat(d.value))
        },
        {
          type: 'ACTIVITY',
          score: activityStats.summary.score,
          weeklyData: activityStats.detailData.weekScore,
          // unit: 'Kcal',
          // status: '평균',
          // weeklyData: activityStats.detailData.weekScore.map(d => parseInt(d.value.toString()))
        }
      ];

      this.logger.log(`통계 목록 조회 완료 - 사용자: ${userId}`);

      return {
        period: '1week',
        dateRange: {
          startDate,
          endDate
        },
        summaryCards
      };
    } catch (error) {
      this.logger.error(`통계 목록 조회 실패 - 사용자: ${userId}`, error);
      throw error;
    }
  }

}