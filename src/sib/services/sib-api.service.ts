import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  ChartExamInfo,
  HomeExamInfo,
  IggLevelsResponse,
  FoodLevelItem,
  UgiLevelsResponse,
  UgiAiSolutionResponse,
} from '../interfaces/sib-response.interface';
import { ExamType, IGG_EXAM_TYPES } from '../enums/exam-type.enum';
import { YesNo } from '../../common/enums';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * SIB 검사 데이터 API 서비스
 * - 외부 API (sib.codns.com:3001) 연동
 * - 인증 없음 (GET 요청)
 * - 타임아웃 5초, 재시도 1회
 * - DB 캐싱: user_allergy_reports 테이블에 IgG 레벨 데이터 캐싱
 */
@Injectable()
export class SibApiService {
  private readonly logger = new Logger(SibApiService.name);
  private readonly baseUrl = 'https://sib.codns.com:3001';
  private readonly timeout = 5000; // 5초 타임아웃
  private readonly maxRetries = 1; // 1회 재시도

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 전화번호로 차트 ID 조회
   * @param mobile 전화번호 (01012345678 형식)
   */
  async getChartIdByMobile(mobile: string): Promise<ChartExamInfo[]> {
    const normalizedMobile = this.normalizeMobile(mobile);
    const endpoint = `/api/challenge/chartIdByMobile?mobile=${normalizedMobile}`;
    return this.callApi<ChartExamInfo[]>(endpoint);
  }

  /**
   * 휴대폰 번호 정규화 (-, 공백 제거)
   */
  private normalizeMobile(mobile: string): string {
    return mobile.replace(/[-\s]/g, '');
  }

  /**
   * 홈 화면용 지연성 알러지 검사 정보 조회
   * - D0004, D0060 중 가장 최신 접수일 기준
   * - 없으면 null 반환
   *
   * @param mobile 전화번호
   */
  async getHomeExamInfo(mobile: string): Promise<HomeExamInfo> {
    try {
      const chartList = await this.getChartIdByMobile(mobile);

      if (!chartList || chartList.length === 0) {
        return { chartId: null, resultYN: YesNo.N };
      }

      // D0004, D0060 필터링
      const iggExams = chartList.filter((exam) =>
        IGG_EXAM_TYPES.includes(exam.orderCode as ExamType),
      );

      if (iggExams.length === 0) {
        return { chartId: null, resultYN: YesNo.N };
      }

      // receiptDate 기준 최신순 정렬
      const latestExam = iggExams.sort(
        (a, b) =>
          new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime(),
      )[0];

      return {
        chartId: latestExam.chartID,
        resultYN: latestExam.resultYN,
      };
    } catch (error) {
      this.logger.error(`홈 검사 정보 조회 실패 (mobile: ${mobile}):`, error);
      return { chartId: null, resultYN: YesNo.N, sibError: true };
    }
  }

  /**
   * 지연성 알러지 검사 결과 조회 (신규)
   * - DB 캐시 우선 조회
   * - 캐시 미스 시 SIB API 호출 후 DB에 저장
   * - SIB 장애 시 캐시 데이터 반환
   * @param chartId 차트 ID
   * @param userId 사용자 ID (캐시 저장용, 선택)
   */
  async getIggLevels(chartId: string, userId?: number): Promise<IggLevelsResponse | null> {
    // 1. DB 캐시 조회
    const cached = await this.getCachedIggLevels(chartId);
    if (cached) {
      this.logger.log(`IgG Levels 캐시 히트 (chartId: ${chartId})`);
      return [cached];
    }

    // 2. SIB API 호출
    try {
      const endpoint = `/api/report/getIggLevels?chartId=${chartId}`;
      const result = await this.callApi<IggLevelsResponse>(endpoint);

      // 3. 결과를 DB에 캐싱
      if (result && result.length > 0 && userId) {
        await this.cacheIggLevels(userId, result[0]);
      }

      return result;
    } catch (error) {
      this.logger.error(`IgG Levels 조회 실패 (chartId: ${chartId}):`, error);
      return null;
    }
  }

  /**
   * 지연성 알러지 검사 결과 조회 (구)
   * - DB 캐시 우선 조회
   * - 캐시 미스 시 SIB API 호출 후 DB에 저장
   * - SIB 장애 시 캐시 데이터 반환
   * @param chartId 차트 ID
   * @param userId 사용자 ID (캐시 저장용, 선택)
   */
  async getIggLevelsOld(chartId: string, userId?: number): Promise<IggLevelsResponse | null> {
    // 1. DB 캐시 조회
    const cached = await this.getCachedIggLevels(chartId);
    if (cached) {
      this.logger.log(`IgG Levels Old 캐시 히트 (chartId: ${chartId})`);
      return [cached];
    }

    // 2. SIB API 호출
    try {
      const endpoint = `/api/report/getIggLevelOld?chartId=${chartId}`;
      const result = await this.callApi<IggLevelsResponse>(endpoint);

      // 3. 결과를 DB에 캐싱
      if (result && result.length > 0 && userId) {
        await this.cacheIggLevels(userId, result[0]);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `IgG Levels Old 조회 실패 (chartId: ${chartId}):`,
        error,
      );
      return null;
    }
  }

  /**
   * DB에서 캐시된 IgG 레벨 데이터 조회
   */
  private async getCachedIggLevels(chartId: string): Promise<FoodLevelItem | null> {
    try {
      const cached = await this.prisma.userAllergyReport.findFirst({
        where: { chartId },
        select: {
          chartId: true,
          userName: true,
          level1: true,
          level2: true,
          level3: true,
          level4: true,
          level5: true,
        },
      });

      if (!cached) return null;

      return {
        chartId: cached.chartId,
        userName: cached.userName,
        level1: cached.level1 || '',
        level2: cached.level2 || '',
        level3: cached.level3 || '',
        level4: cached.level4 || '',
        level5: cached.level5 || '',
      };
    } catch (error) {
      this.logger.warn(`IgG 캐시 조회 실패 (chartId: ${chartId}):`, error);
      return null;
    }
  }

  /**
   * IgG 레벨 데이터를 DB에 캐싱
   */
  private async cacheIggLevels(userId: number, data: FoodLevelItem): Promise<void> {
    try {
      // chartId가 unique가 아니므로 findFirst + create/update 패턴 사용
      const existing = await this.prisma.userAllergyReport.findFirst({
        where: { chartId: data.chartId },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.userAllergyReport.update({
          where: { id: existing.id },
          data: {
            userName: data.userName,
            level1: data.level1,
            level2: data.level2,
            level3: data.level3,
            level4: data.level4,
            level5: data.level5,
            updatedAt: getNowKST(),
          },
        });
      } else {
        await this.prisma.userAllergyReport.create({
          data: {
            userId,
            chartId: data.chartId,
            userName: data.userName,
            level1: data.level1,
            level2: data.level2,
            level3: data.level3,
            level4: data.level4,
            level5: data.level5,
            createdAt: getNowKST(),
          },
        });
      }
      this.logger.log(`IgG Levels 캐시 저장 완료 (chartId: ${data.chartId})`);
    } catch (error) {
      this.logger.warn(`IgG 캐시 저장 실패 (chartId: ${data.chartId}):`, error);
      // 캐시 저장 실패해도 에러 throw 안 함
    }
  }

  /**
   * 종합대사기능 검사 결과 조회
   * @param chartId 차트 ID
   */
  async getUgiLevels(chartId: string): Promise<UgiLevelsResponse | null> {
    try {
      const endpoint = `/api/report/getUgiLevels?chartId=${chartId}`;
      return this.callApi<UgiLevelsResponse>(endpoint);
    } catch (error) {
      this.logger.error(`UGI Levels 조회 실패 (chartId: ${chartId}):`, error);
      return null;
    }
  }

  /**
   * 종합대사기능 - 영양제 추천 조회
   * @param username 차트 ID (username 파라미터로 전달)
   */
  async getUgiAiSolution(
    username: string,
  ): Promise<UgiAiSolutionResponse | null> {
    try {
      const endpoint = `/api/Ugi/ai/solution?username=${username}`;
      return this.callApi<UgiAiSolutionResponse>(endpoint);
    } catch (error) {
      this.logger.error(
        `UGI AI Solution 조회 실패 (username: ${username}):`,
        error,
      );
      return null;
    }
  }

  /**
   * API 호출 헬퍼
   * - 5초 타임아웃
   * - 1회 재시도
   */
  private async callApi<T>(endpoint: string, retryCount = 0): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      this.logger.log(`SIB API 호출: GET ${endpoint}`);

      const response = await firstValueFrom(
        this.httpService.get<T>(url, { timeout: this.timeout }),
      );

      this.logger.log(`SIB API 성공: GET ${endpoint}`);
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message || '알 수 없는 오류';
      this.logger.error(
        `SIB API 실패 (시도 ${retryCount + 1}/${this.maxRetries + 1}): GET ${endpoint}`,
        errorMsg,
      );

      // 재시도
      if (retryCount < this.maxRetries) {
        await this.delay(1000); // 1초 대기 후 재시도
        return this.callApi<T>(endpoint, retryCount + 1);
      }

      // 최종 실패
      throw error;
    }
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
