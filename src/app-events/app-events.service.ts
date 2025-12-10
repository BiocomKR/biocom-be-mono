import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { GetAppEventsDto } from './dto/get-app-events.dto';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class AppEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhereClause(dto: {
    appId?: string;
    eventName?: string;
    eventCategory?: string;
    userId?: number;
    itemType?: string;
    startDate?: string;
    endDate?: string;
  }): Prisma.AppEventWhereInput {
    const where: Prisma.AppEventWhereInput = {};

    if (dto.appId) {
      where.appId = dto.appId;
    }

    if (dto.eventName) {
      where.eventName = dto.eventName;
    }

    if (dto.eventCategory) {
      where.eventCategory = dto.eventCategory;
    }

    if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.itemType) {
      where.itemType = dto.itemType;
    }

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) {
        where.createdAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.createdAt.lte = new Date(dto.endDate);
      }
    }

    return where;
  }

  async findAll(dto: GetAppEventsDto) {
    const { page = 1, limit = 20 } = dto;
    const where = this.buildWhereClause(dto);

    const [items, total] = await Promise.all([
      this.prisma.appEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appEvent.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEventStats(dto: {
    appId?: string;
    eventCategory?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where = this.buildWhereClause(dto);

    const stats = await this.prisma.appEvent.groupBy({
      by: ['eventName'],
      where,
      _count: { id: true },
    });

    return stats.map((s) => ({
      eventName: s.eventName,
      count: s._count.id,
    }));
  }

  async getPlatformStats(dto: {
    appId?: string;
    eventCategory?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where = this.buildWhereClause(dto);

    const stats = await this.prisma.appEvent.groupBy({
      by: ['platform'],
      where,
      _count: { id: true },
    });

    return stats.map((s) => ({
      platform: s.platform,
      count: s._count.id,
    }));
  }

  async getCategoryStats(dto: {
    appId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where = this.buildWhereClause(dto);

    const stats = await this.prisma.appEvent.groupBy({
      by: ['eventCategory'],
      where,
      _count: { id: true },
    });

    return stats.map((s) => ({
      eventCategory: s.eventCategory || 'unknown',
      count: s._count.id,
    }));
  }

  async getEcommerceStats(dto: {
    appId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const baseWhere = this.buildWhereClause(dto);
    const where: Prisma.AppEventWhereInput = {
      ...baseWhere,
      eventCategory: 'ecommerce',
      amount: { not: null },
    };

    const result = await this.prisma.appEvent.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    // 주문 수 (purchase 이벤트)
    const purchaseCount = await this.prisma.appEvent.count({
      where: { ...where, eventName: 'purchase' },
    });

    return {
      totalAmount: result._sum.amount || 0,
      totalEvents: result._count.id,
      purchaseCount,
    };
  }

  async getSummary(dto: {
    appId?: string;
    eventCategory?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where = this.buildWhereClause(dto);

    // 오늘/어제 날짜 계산 (KST 기준)
    const today = getNowKST();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime());
    yesterday.setDate(yesterday.getDate() - 1);

    // 이번 주/지난 주 계산
    const thisWeekStart = new Date(today.getTime());
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(thisWeekStart.getTime());
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart.getTime());

    // appId, eventCategory 필터 유지
    const baseFilter: Prisma.AppEventWhereInput = {};
    if (dto.appId) baseFilter.appId = dto.appId;
    if (dto.eventCategory) baseFilter.eventCategory = dto.eventCategory;

    const [
      todayEvents,
      yesterdayEvents,
      thisWeekEvents,
      lastWeekEvents,
      activeUsersResult,
    ] = await Promise.all([
      // 오늘 이벤트
      this.prisma.appEvent.count({
        where: { ...baseFilter, createdAt: { gte: today } },
      }),
      // 어제 이벤트
      this.prisma.appEvent.count({
        where: { ...baseFilter, createdAt: { gte: yesterday, lt: today } },
      }),
      // 이번 주 이벤트
      this.prisma.appEvent.count({
        where: { ...baseFilter, createdAt: { gte: thisWeekStart } },
      }),
      // 지난 주 이벤트
      this.prisma.appEvent.count({
        where: { ...baseFilter, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
      }),
      // 활성 유저 수
      this.prisma.appEvent.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
      }),
    ]);

    // 증감률 계산
    const dailyChangeRate = yesterdayEvents > 0
      ? Math.round(((todayEvents - yesterdayEvents) / yesterdayEvents) * 100)
      : todayEvents > 0 ? 100 : 0;

    const weeklyChangeRate = lastWeekEvents > 0
      ? Math.round(((thisWeekEvents - lastWeekEvents) / lastWeekEvents) * 100)
      : thisWeekEvents > 0 ? 100 : 0;

    return {
      todayEvents,
      yesterdayEvents,
      dailyChangeRate,
      thisWeekEvents,
      lastWeekEvents,
      weeklyChangeRate,
      activeUsers: activeUsersResult.length,
    };
  }

  // 시간대별 이벤트 (0~23시)
  async getHourlyStats(dto: {
    appId?: string;
    eventCategory?: string;
    startDate?: string;
    endDate?: string;
  }) {
    let where = this.buildWhereClause(dto);

    // 기본: 오늘 데이터 (KST 기준)
    if (!dto.startDate && !dto.endDate) {
      const today = getNowKST();
      today.setHours(0, 0, 0, 0);
      where = { ...where, createdAt: { gte: today } };
    }

    const events = await this.prisma.appEvent.findMany({
      where,
      select: { createdAt: true },
    });

    // 시간대별 집계
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
    }));

    events.forEach((event) => {
      // UTC 기준으로 시간 추출 (서버/로컬 환경 무관하게 동일한 결과)
      const hour = new Date(event.createdAt).getUTCHours();
      hourlyData[hour].count++;
    });

    return hourlyData;
  }

  // 일별 추이 (최근 7일)
  async getDailyTrend(dto: {
    appId?: string;
    eventCategory?: string;
  }) {
    const result = [];
    const today = getNowKST();
    today.setHours(0, 0, 0, 0);

    // appId, eventCategory 필터
    const baseFilter: Prisma.AppEventWhereInput = {};
    if (dto.appId) baseFilter.appId = dto.appId;
    if (dto.eventCategory) baseFilter.eventCategory = dto.eventCategory;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.prisma.appEvent.count({
        where: {
          ...baseFilter,
          createdAt: { gte: date, lt: nextDate },
        },
      });

      result.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return result;
  }
}
