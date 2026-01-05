import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { SibApiService } from '../sib/services/sib-api.service';
import { ExamType, IGG_EXAM_TYPES } from '../sib/enums/exam-type.enum';
import {
  ChartExamInfo,
  IggLevelsResponse,
} from '../sib/interfaces/sib-response.interface';

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
   * 1. JWT에서 userId로 유저 mobile, 동물 정보, 챌린지 정보 조회
   * 2. mobile로 검사 목록 조회 (D0004, D0060만)
   * 3. 최신 검사 선택
   * 4. orderCode에 따라 신/구 API 호출
   * 5. 결과 반환 (챌린지 유무, 동물 유무 포함)
   */
  async getFoodLevels(
    userId: number,
    chartId?: string,
  ): Promise<{
    orderCode: string;
    data: IggLevelsResponse;
    hasChallenge: boolean;
    hasAnimal: boolean;
    hasStartDate: boolean;
  }> {
    // 1. 유저 mobile, 동물 정보, 챌린지 정보 조회 (한 번에 조회)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        mobile: true,
        health_type_animal_id: true,
        userChallenges: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { id: true, activatedAt: true, expiresAt: true },
        },
      },
    });

    if (!user?.mobile) {
      throw new NotFoundException('유저 정보를 찾을 수 없습니다');
    }

    const activeChallenge = user.userChallenges[0] ?? null;
    const hasChallenge = activeChallenge !== null;
    const hasAnimal = user.health_type_animal_id !== null;
    const hasStartDate = activeChallenge?.activatedAt !== null;

    // 2. 검사 목록 조회
    let chartList: ChartExamInfo[];
    try {
      chartList = await this.sibApiService.getChartIdByMobile(user.mobile);
    } catch (error) {
      this.logger.error(`SIB API 호출 실패 - userId: ${userId}`, error);
      throw new ServiceUnavailableException(
        '검사 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

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

    // chartId가 있으면 해당 검사, 없으면 최신 검사
    let targetExam: ChartExamInfo;
    if (chartId) {
      const found = iggExams.find((exam) => exam.chartID === chartId);
      if (!found) {
        throw new NotFoundException(
          `chartId(${chartId})에 해당하는 검사 결과가 없습니다`,
        );
      }
      targetExam = found;
    } else {
      targetExam = iggExams[0];
    }
    this.logger.log(
      `식품 레벨 조회 - userId: ${userId}, chartID: ${targetExam.chartID}, orderCode: ${targetExam.orderCode}`,
    );

    // 4. orderCode에 따라 신/구 API 호출 (userId 전달하여 캐싱)
    let data: IggLevelsResponse | null;
    if (targetExam.orderCode === IGG_OLD_EXAM_TYPE) {
      data = await this.sibApiService.getIggLevelsOld(targetExam.chartID, userId);
    } else {
      data = await this.sibApiService.getIggLevels(targetExam.chartID, userId);
    }

    if (!data) {
      throw new NotFoundException('검사 결과 데이터를 가져올 수 없습니다');
    }

    // 5. 결과 반환 (챌린지 유무, 동물 유무, 시작일 지정 여부 포함)
    return {
      orderCode: targetExam.orderCode,
      data,
      hasChallenge,
      hasAnimal,
      hasStartDate,
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

    let chartList: ChartExamInfo[];
    try {
      chartList = await this.sibApiService.getChartIdByMobile(user.mobile);
    } catch (error) {
      this.logger.error(`SIB API 호출 실패 - userId: ${userId}`, error);
      throw new ServiceUnavailableException(
        '검사 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

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
