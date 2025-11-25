import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

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
    relatedType?: string,
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
   */
  async awardPoints(
    userId: number,
    amount: number,
    description: string,
    relatedType?: string,
    relatedId?: number,
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
          relatedType: relatedType || 'MANUAL',
          relatedId,
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
   */
  async awardPointsInTransaction(
    tx: any,
    userId: number,
    amount: number,
    description: string,
    relatedType?: string,
    relatedId?: number,
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
        relatedType: relatedType || 'MANUAL',
        relatedId,
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
          relatedType: 'IMWEB_TRANSFER',
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
          relatedType: 'IMWEB_TRANSFER',
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
   */
  async getHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    return await this.prisma.pointHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 포인트 내역 전체 개수 조회
   * 
   * @param userId 사용자 ID
   * @returns 전체 거래 내역 개수
   */
  async getHistoryCount(userId: number): Promise<number> {
    return await this.prisma.pointHistory.count({
      where: { userId }
    });
  }

  /**
   * 포인트 적립
   * 
   * @param userId 사용자 ID
   * @param amount 적립할 포인트
   * @param description 적립 사유
   * @param relatedType 관련 타입
   * @param relatedId 관련 ID
   */
  async addPoints(
    userId: number,
    amount: number,
    description: string,
    relatedType?: string,
    relatedId?: number,
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
          type: 'EARN',
          amount: amount, // 적립은 양수로 기록
          balance: updatedUser.points, // 실제 잔액
          description,
          relatedType,
          relatedId,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`포인트 적립 완료 - 잔액: ${updatedUser.points}`);
    });
  }
}