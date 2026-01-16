import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';
import { PointRelatedType, UserChallengeStatus } from '../common/enums';

// 포인트 지급 설정 타입
interface PointsConfig {
  afterChallengeDays?: number;     // 챌린지 종료 후 N일까지 포인트 지급 (0이면 종료 즉시 포인트 없음)
  subscriberUnlimited?: boolean;   // 구독자 무제한 여부
}

/**
 * 포인트 관리 서비스
 * 포인트 적립, 차감, 이관 등 포인트 관련 모든 로직 처리
 */
@Injectable()
export class PointService {
  private readonly logger = new Logger(PointService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 포인트 차감
   * 
   * @param userId 사용자 ID
   * @param amount 차감할 포인트
   * @param description 차감 사유
   * @param relatedType 관련 타입 (ORDER, TRANSFER 등)
   * @param relatedId 관련 ID
   */
  async deductPoints(
    userId: number,
    amount: number,
    description: string,
    relatedType?: PointRelatedType,
    relatedId?: number,
  ): Promise<void> {
    this.logger.log(`포인트 차감 - 사용자: ${userId}, 금액: ${amount}`);

    if (amount <= 0) {
      throw new BadRequestException('차감 금액은 0보다 커야 합니다.');
    }

    // 트랜잭션 내에서 모든 작업 처리 (동시성 문제 방지)
    await this.prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 포인트 확인 (락 획득)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { points: true },
      });

      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다.');
      }

      if (user.points < amount) {
        throw new BadRequestException(`포인트가 부족합니다. (보유: ${user.points}, 필요: ${amount})`);
      }

      // 사용자 포인트 차감
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { decrement: amount },
        },
      });

      // 음수 체크 (추가 안전장치)
      if (updatedUser.points < 0) {
        throw new BadRequestException('포인트가 음수가 될 수 없습니다.');
      }

      // 차감 이력 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'SPEND',
          amount: -amount, // 차감은 음수로 기록
          balance: updatedUser.points, // 실제 잔액
          description,
          relatedType,
          relatedId,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`포인트 차감 완료 - 잔액: ${updatedUser.points}`);
    });
  }

  /**
   * 포인트 지급 (적립)
   *
   * @param userId 사용자 ID
   * @param amount 지급할 포인트
   * @param description 지급 사유
   * @param relatedType 관련 타입 (RECORD_COMPLETION, MISSION_COMPLETION 등)
   * @param relatedId 관련 ID
   * @param recordType 기록 타입 (BEAUTY, DIET, SUPPLEMENT 등)
   */
  async awardPoints(
    userId: number,
    amount: number,
    description: string,
    relatedType?: PointRelatedType,
    relatedId?: number,
    recordType?: string,
  ): Promise<number> {
    this.logger.log(`포인트 지급 - 사용자: ${userId}, 금액: ${amount}`);

    if (amount <= 0) {
      throw new BadRequestException('지급 금액은 0보다 커야 합니다.');
    }

    // 트랜잭션 내에서 모든 작업 처리
    return await this.prisma.$transaction(async (tx) => {
      // 사용자 포인트 증가
      const user = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: amount } },
      });

      // 포인트 히스토리 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'EARNED',
          amount: amount,
          balance: user.points,
          description,
          relatedType: relatedType || PointRelatedType.MANUAL,
          relatedId,
          recordType,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`포인트 지급 완료 - 사용자: ${userId}, 잔액: ${user.points}`);
      return user.points;
    });
  }

  /**
   * 트랜잭션 내에서 포인트 지급 (다른 서비스에서 트랜잭션과 함께 사용)
   *
   * @param tx 트랜잭션 객체
   * @param userId 사용자 ID
   * @param amount 지급할 포인트
   * @param description 지급 사유
   * @param relatedType 관련 타입
   * @param relatedId 관련 ID
   * @param recordType 기록 타입 (BEAUTY, DIET, SUPPLEMENT 등)
   */
  async awardPointsInTransaction(
    tx: any,
    userId: number,
    amount: number,
    description: string,
    relatedType?: PointRelatedType,
    relatedId?: number,
    recordType?: string,
  ): Promise<number> {
    if (amount <= 0) {
      throw new BadRequestException('지급 금액은 0보다 커야 합니다.');
    }

    // 사용자 포인트 증가
    const user = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
    });

    // 포인트 히스토리 기록
    await tx.pointHistory.create({
      data: {
        userId,
        type: 'EARNED',
        amount: amount,
        balance: user.points,
        description,
        relatedType: relatedType || PointRelatedType.MANUAL,
        relatedId,
        recordType,
        createdAt: getNowKST(),
      },
    });

    return user.points;
  }

  /**
   * 아임웹으로 포인트 이관
   * 
   * @param userId 사용자 ID
   * @param amount 이관할 포인트
   */
  async transferToImweb(userId: number, amount: number): Promise<void> {
    this.logger.log(`아임웹 포인트 이관 - 사용자: ${userId}, 금액: ${amount}`);

    if (amount <= 0) {
      throw new BadRequestException('이관 금액은 0보다 커야 합니다.');
    }

    // 트랜잭션 내에서 모든 작업 처리 (동시성 문제 방지)
    await this.prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 포인트 확인 (락 획득)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { points: true, email: true },
      });

      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다.');
      }

      if (user.points < amount) {
        throw new BadRequestException(`포인트가 부족합니다. (보유: ${user.points}, 이관 요청: ${amount})`);
      }

      // 사용자 포인트 차감
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { decrement: amount },
        },
      });

      // 음수 체크 (추가 안전장치)
      if (updatedUser.points < 0) {
        throw new BadRequestException('포인트가 음수가 될 수 없습니다.');
      }

      // 이관 이력 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'TRANSFER_OUT',
          amount: -amount, // 차감은 음수로 기록
          balance: updatedUser.points, // 실제 잔액
          description: `아임웹으로 포인트 이관`,
          relatedType: PointRelatedType.IMWEB_TRANSFER,
          createdAt: getNowKST(),
        },
      });

      // TODO: 아임웹 API 호출하여 실제 포인트 적립
      // await this.imwebService.addPoints(user.email, amount);

      this.logger.log(`아임웹 포인트 이관 완료 - 잔액: ${updatedUser.points}`);
    });
  }

  /**
   * 아임웹에서 포인트 가져오기 (추후 구현)
   * 
   * @param userId 사용자 ID
   * @param amount 가져올 포인트
   */
  async transferFromImweb(userId: number, amount: number): Promise<void> {
    this.logger.log(`아임웹 포인트 가져오기 - 사용자: ${userId}, 금액: ${amount}`);

    if (amount <= 0) {
      throw new BadRequestException('가져올 금액은 0보다 커야 합니다.');
    }

    // TODO: 아임웹 API 호출하여 실제 포인트 차감 확인
    // const imwebBalance = await this.imwebService.getBalance(user.email);
    // if (imwebBalance < amount) throw ...

    // 트랜잭션으로 적립 처리
    await this.prisma.$transaction(async (tx) => {
      // 사용자 포인트 적립
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: amount },
        },
      });

      // 적립 이력 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'TRANSFER_IN',
          amount: amount, // 적립은 양수로 기록
          balance: updatedUser.points, // 실제 잔액
          description: `아임웹에서 포인트 가져오기`,
          relatedType: PointRelatedType.IMWEB_TRANSFER,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`아임웹 포인트 가져오기 완료 - 잔액: ${updatedUser.points}`);
    });
  }

  /**
   * 사용자 포인트 잔액 조회
   * 
   * @param userId 사용자 ID
   */
  async getBalance(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }

    return user.points;
  }

  /**
   * 포인트 내역 조회
   *
   * @param userId 사용자 ID
   * @param limit 조회 개수
   * @param offset 시작 위치
   * @param startDate 시작 날짜 (YYYY-MM-DD)
   * @param endDate 종료 날짜 (YYYY-MM-DD)
   */
  async getHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const where: any = { userId };

    // 날짜 필터 적용
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const items = await this.prisma.pointHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // description에서 영어 ID 부분 제거 (예: "심층리포트 조회 (report_abc123)" → "심층리포트 조회")
    // TODO: 추후 일괄적으로 파싱할 수 있도록 변경 필요 (description 포맷 표준화 또는 별도 파서 모듈화)
    return items.map(item => ({
      ...item,
      description: item.description?.replace(/\s*\([a-zA-Z0-9_-]+\)\s*$/, '').trim() || item.description,
    }));
  }

  /**
   * 포인트 내역 전체 개수 조회
   *
   * @param userId 사용자 ID
   * @param startDate 시작 날짜 (YYYY-MM-DD)
   * @param endDate 종료 날짜 (YYYY-MM-DD)
   * @returns 전체 거래 내역 개수
   */
  async getHistoryCount(userId: number, startDate?: string, endDate?: string): Promise<number> {
    const where: any = { userId };

    // 날짜 필터 적용
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    return await this.prisma.pointHistory.count({ where });
  }

  /**
   * 포인트 적립
   *
   * @param userId 사용자 ID
   * @param amount 적립할 포인트
   * @param description 적립 사유
   * @param relatedType 관련 타입
   * @param relatedId 관련 ID
   * @param recordType 기록 타입 (BEAUTY, DIET, SUPPLEMENT 등)
   */
  async addPoints(
    userId: number,
    amount: number,
    description: string,
    relatedType?: PointRelatedType,
    relatedId?: number,
    recordType?: string,
  ): Promise<void> {
    this.logger.log(`포인트 적립 - 사용자: ${userId}, 금액: ${amount}`);

    if (amount <= 0) {
      throw new BadRequestException('적립 금액은 0보다 커야 합니다.');
    }

    // 트랜잭션 내에서 처리
    await this.prisma.$transaction(async (tx) => {
      // 사용자 포인트 적립
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: amount },
        },
      });

      // 적립 이력 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'EARNED',
          amount: amount, // 적립은 양수로 기록
          balance: updatedUser.points, // 실제 잔액
          description,
          relatedType,
          relatedId,
          recordType,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`포인트 적립 완료 - 잔액: ${updatedUser.points}`);
    });
  }

  /**
   * 포인트 지급 가능 여부 체크
   * pointsConfig 설정에 따라 계급별, 일차별 포인트 지급 가능 여부 판단
   *
   * @param userId 사용자 ID
   * @param recordType 기록 타입 (BEAUTY, DIET, WEEKLY_REPORT 등)
   * @returns { canAward: boolean, reason?: string }
   */
  async checkPointsEligibility(
    userId: number,
    recordType: string,
  ): Promise<{ canAward: boolean; reason?: string }> {
    // 1. 사용자 정보 및 활성 챌린지 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        userChallenges: {
          where: { status: UserChallengeStatus.ACTIVE },
          orderBy: { activatedAt: 'desc' },
          take: 1,
          select: {
            activatedAt: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return { canAward: false, reason: '사용자를 찾을 수 없습니다' };
    }

    // 2. 미션 설정 조회
    const mission = await this.prisma.mission.findUnique({
      where: { recordType },
      select: {
        id: true,
        pointsConfig: true,
        totalDays: true,
      },
    });

    if (!mission) {
      // 미션 설정이 없으면 기본적으로 지급 허용
      return { canAward: true };
    }

    // 3. pointsConfig가 없으면 기본적으로 지급 허용
    const pointsConfig = mission.pointsConfig as PointsConfig | null;
    if (!pointsConfig) {
      return { canAward: true };
    }

    // 4. 사용자 계급에 해당하는 설정 확인
    const userStatus = user.status;
    const userConfig = pointsConfig[userStatus];

    if (!userConfig) {
      // 해당 계급 설정이 없으면 지급 불가
      return { canAward: false, reason: `${userStatus} 계급에 대한 포인트 설정이 없습니다` };
    }

    // 5. 무제한이면 지급 허용
    if (userConfig.unlimited) {
      return { canAward: true };
    }

    // 6. untilDay 체크
    if (userConfig.untilDay) {
      const activeChallenge = user.userChallenges[0];

      if (!activeChallenge) {
        // 활성 챌린지가 없으면 지급 불가
        return { canAward: false, reason: '활성 챌린지가 없습니다' };
      }

      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);

      if (currentDay > userConfig.untilDay) {
        return {
          canAward: false,
          reason: `포인트 지급 가능 기간(${userConfig.untilDay}일차)을 초과했습니다 (현재 ${currentDay}일차)`
        };
      }
    }

    return { canAward: true };
  }
}