import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { SibApiService } from '../sib/services/sib-api.service';
import { ExamType, IGG_EXAM_TYPES } from '../sib/enums/exam-type.enum';
import { IggLevelsResponse } from '../sib/interfaces/sib-response.interface';

/** D0004: 구 지연성 알러지, D0060: 신 지연성 알러지 */
const IGG_OLD_EXAM_TYPE = 'D0004';

/**
 * 검사 결과 서비스
 * - 유저 정보 조회 → SIB API 호출 → 결과 반환
 */
@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sibApiService: SibApiService,
  ) {}

  /**
   * 식품 레벨 조회
   * 1. JWT에서 userId로 유저 mobile 조회
   * 2. mobile로 검사 목록 조회 (D0004, D0060만)
   * 3. 최신 검사 선택
   * 4. orderCode에 따라 신/구 API 호출
   * 5. 결과 반환
   */
  async getFoodLevels(userId: number): Promise<{
    orderCode: string;
    data: IggLevelsResponse;
  }> {
    // 1. 유저 mobile 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mobile: true },
    });

    if (!user?.mobile) {
      throw new NotFoundException('유저 정보를 찾을 수 없습니다');
    }

    // 2. 검사 목록 조회
    const chartList = await this.sibApiService.getChartIdByMobile(user.mobile);

    if (!chartList || chartList.length === 0) {
      throw new NotFoundException('검사 결과가 없습니다');
    }

    // 3. D0004, D0060만 필터링 후 최신순 정렬
    const iggExams = chartList
      .filter((exam) => IGG_EXAM_TYPES.includes(exam.orderCode as ExamType))
      .sort(
        (a, b) =>
          new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime(),
      );

    if (iggExams.length === 0) {
      throw new NotFoundException('지연성 알러지 검사 결과가 없습니다');
    }

    const latestExam = iggExams[0];
    this.logger.log(
      `식품 레벨 조회 - userId: ${userId}, chartID: ${latestExam.chartID}, orderCode: ${latestExam.orderCode}`,
    );

    // 4. orderCode에 따라 신/구 API 호출
    let data: IggLevelsResponse | null;
    if (latestExam.orderCode === IGG_OLD_EXAM_TYPE) {
      data = await this.sibApiService.getIggLevelsOld(latestExam.chartID);
    } else {
      data = await this.sibApiService.getIggLevels(latestExam.chartID);
    }

    if (!data) {
      throw new NotFoundException('검사 결과 데이터를 가져올 수 없습니다');
    }

    // 5. 결과 반환
    return {
      orderCode: latestExam.orderCode,
      data,
    };
  }

  /**
   * 검사 결과 목록 조회 (지연성 알러지 D0004, D0060만)
   * SIB API 응답을 그대로 반환
   */
  async getExamList(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mobile: true },
    });

    if (!user?.mobile) {
      throw new NotFoundException('유저 정보를 찾을 수 없습니다');
    }

    const chartList = await this.sibApiService.getChartIdByMobile(user.mobile);

    if (!chartList || chartList.length === 0) {
      return [];
    }

    // D0004, D0060만 필터링 후 최신순 정렬
    return chartList
      .filter((exam) => IGG_EXAM_TYPES.includes(exam.orderCode as ExamType))
      .sort(
        (a, b) =>
          new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime(),
      );
  }
}
