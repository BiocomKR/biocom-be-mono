import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 백오피스 포인트 관리 서비스
 */
@Injectable()
export class ManagementPointService {
  private readonly logger = new Logger(ManagementPointService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 포인트 잔액 조회
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
   */
  async getHistoryCount(userId: number): Promise<number> {
    return await this.prisma.pointHistory.count({
      where: { userId }
    });
  }

  /**
   * 포인트 차감
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

    await this.prisma.$transaction(async (tx) => {
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

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { decrement: amount },
        },
      });

      if (updatedUser.points < 0) {
        throw new BadRequestException('포인트가 음수가 될 수 없습니다.');
      }

      await tx.pointHistory.create({
        data: {
          userId,
          type: 'SPEND',
          amount: -amount,
          balance: updatedUser.points,
          description,
          relatedType,
          relatedId,
          createdAt: getNowKST(),
        },
      });
    });
  }

  /**
   * 포인트 적립
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

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: amount },
        },
      });

      await tx.pointHistory.create({
        data: {
          userId,
          type: 'EARN',
          amount: amount,
          balance: updatedUser.points,
          description,
          relatedType,
          relatedId,
          createdAt: getNowKST(),
        },
      });
    });
  }
}
