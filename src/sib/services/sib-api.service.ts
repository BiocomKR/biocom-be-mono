import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  ChartExamInfo,
  HomeExamInfo,
  IggLevelsResponse,
  UgiLevelsResponse,
  UgiAiSolutionResponse,
} from '../interfaces/sib-response.interface';
import { ExamType, IGG_EXAM_TYPES } from '../enums/exam-type.enum';

/**
 * SIB 검사 데이터 API 서비스
 * - 외부 API (sib.codns.com:3001) 연동
 * - 인증 없음 (GET 요청)
 * - 타임아웃 5초, 재시도 1회
 */
@Injectable()
export class SibApiService {
  private readonly logger = new Logger(SibApiService.name);
  private readonly baseUrl = 'https://sib.codns.com:3001';
  private readonly timeout = 5000; // 5초 타임아웃
  private readonly maxRetries = 1; // 1회 재시도

  constructor(private readonly httpService: HttpService) {}

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
        return { chartId: null, resultYN: null };
      }

      // D0004, D0060 필터링
      const iggExams = chartList.filter((exam) =>
        IGG_EXAM_TYPES.includes(exam.examType as ExamType),
      );

      if (iggExams.length === 0) {
        return { chartId: null, resultYN: null };
      }

      // receiptDate 기준 최신순 정렬
      const latestExam = iggExams.sort(
        (a, b) =>
          new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime(),
      )[0];

      return {
        chartId: latestExam.chartId,
        resultYN: latestExam.resultYN,
      };
    } catch (error) {
      this.logger.error(`홈 검사 정보 조회 실패 (mobile: ${mobile}):`, error);
      return { chartId: null, resultYN: null, sibError: true };
    }
  }

  /**
   * 지연성 알러지 검사 결과 조회 (신규)
   * @param chartId 차트 ID
   */
  async getIggLevels(chartId: string): Promise<IggLevelsResponse | null> {
    try {
      const endpoint = `/api/report/getIggLevels?chartId=${chartId}`;
      return this.callApi<IggLevelsResponse>(endpoint);
    } catch (error) {
      this.logger.error(`IgG Levels 조회 실패 (chartId: ${chartId}):`, error);
      return null;
    }
  }

  /**
   * 지연성 알러지 검사 결과 조회 (구)
   * @param chartId 차트 ID
   */
  async getIggLevelsOld(chartId: string): Promise<IggLevelsResponse | null> {
    try {
      const endpoint = `/api/report/getIggLevelOld?chartId=${chartId}`;
      return this.callApi<IggLevelsResponse>(endpoint);
    } catch (error) {
      this.logger.error(
        `IgG Levels Old 조회 실패 (chartId: ${chartId}):`,
        error,
      );
      return null;
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
