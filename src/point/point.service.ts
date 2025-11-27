import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { CryptoUtil } from '../common/utils/crypto.util';

/**
 * 백오피스 포인트 관리 서비스
 */
@Injectable()
export class PointService {
  private readonly logger = new Logger(PointService.name);

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
   * 포인트 내역 조회 (특정 사용자)
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
   * 포인트 내역 전체 개수 조회 (특정 사용자)
   */
  async getHistoryCount(userId: number): Promise<number> {
    return await this.prisma.pointHistory.count({
      where: { userId }
    });
  }

  /**
   * 전체 포인트 내역 조회 (페이지네이션, 필터 지원)
   */
  async getAllHistory(params: {
    page: number;
    limit: number;
    type?: string;
    relatedType?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, type, relatedType, search, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    // where 조건 구성
    const where: any = {};

    // 타입 필터 처리 (EARN/EARNED, USE/SPEND/SPENT 혼재 대응)
    if (type && type !== 'ALL') {
      if (type === 'EARN' || type === 'EARNED') {
        where.type = { in: ['EARN', 'EARNED'] };
      } else if (type === 'USE' || type === 'SPEND' || type === 'SPENT') {
        where.type = { in: ['USE', 'SPEND', 'SPENT'] };
      } else {
        where.type = type;
      }
    }

    if (relatedType && relatedType !== 'ALL') {
      where.relatedType = relatedType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 검색어가 있으면 사용자 이름/휴대폰 번호로 필터
    // 암호화된 필드이므로 별도 처리 필요
    let userIds: number[] | null = null;
    if (search) {
      const searchKeyword = search.trim();
      const isPhoneNumber = /^[0-9-]+$/.test(searchKeyword);

      if (isPhoneNumber) {
        // 휴대폰 번호 검색: Prisma 미들웨어가 자동으로 암호화 처리
        const normalizedPhone = searchKeyword.replace(/[^0-9]/g, '');
        const users = await this.prisma.user.findMany({
          where: { mobile: normalizedPhone },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      } else {
        // 이름 검색: GCM 암호화는 직접 검색 불가, 전체 조회 후 필터링
        const users = await this.prisma.user.findMany({
          select: { id: true, name: true },
          take: 1000,
        });
        userIds = users
          .filter((u) => {
            const decryptedName = CryptoUtil.decrypt(u.name);
            return decryptedName && decryptedName.includes(searchKeyword);
          })
          .map((u) => u.id);
      }

      if (userIds.length === 0) {
        // 검색 결과 없음
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      where.userId = { in: userIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.pointHistory.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.pointHistory.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.user?.name ? CryptoUtil.decrypt(item.user.name) : '-',
        userMobile: item.user?.mobile ? this.formatPhoneNumber(CryptoUtil.decryptDeterministic(item.user.mobile)) : '-',
        type: item.type,
        amount: item.amount,
        balance: item.balance,
        description: item.description,
        relatedType: item.relatedType,
        relatedId: item.relatedId,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 포인트 통계 조회
   */
  async getStats(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 백엔드 기록에 EARN/EARNED, SPEND/SPENT/USE 혼재
    const [earnData, spendData, totalTransactions] = await Promise.all([
      this.prisma.pointHistory.aggregate({
        where: { ...where, type: { in: ['EARN', 'EARNED'] } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.pointHistory.aggregate({
        where: { ...where, type: { in: ['SPEND', 'SPENT', 'USE'] } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.pointHistory.count({ where }),
    ]);

    const totalEarned = earnData._sum.amount || 0;
    const totalSpent = Math.abs(spendData._sum.amount || 0);

    return {
      totalEarned,
      totalSpent,
      netChange: totalEarned - totalSpent,
      totalTransactions,
      earnCount: earnData._count,
      spendCount: spendData._count,
    };
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

  /**
   * 전화번호 포맷팅 (010-1234-5678)
   */
  private formatPhoneNumber(phone: string): string {
    if (!phone) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }
}
