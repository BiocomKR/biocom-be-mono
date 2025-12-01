import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { GetAppEventsDto } from './dto/get-app-events.dto';

@Injectable()
export class AppEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: GetAppEventsDto) {
    const { eventName, userId, startDate, endDate, page = 1, limit = 20 } = dto;

    const where: any = {};

    if (eventName) {
      where.eventName = eventName;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

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

  async getEventStats(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

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

  async getPlatformStats(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

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

  async getSummary(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 오늘/어제 날짜 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 이번 주/지난 주 계산
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const [
      todayEvents,
      yesterdayEvents,
      thisWeekEvents,
      lastWeekEvents,
      activeUsersResult,
    ] = await Promise.all([
      // 오늘 이벤트
      this.prisma.appEvent.count({
        where: { createdAt: { gte: today } },
      }),
      // 어제 이벤트
      this.prisma.appEvent.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      // 이번 주 이벤트
      this.prisma.appEvent.count({
        where: { createdAt: { gte: thisWeekStart } },
      }),
      // 지난 주 이벤트
      this.prisma.appEvent.count({
        where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
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
  async getHourlyStats(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 기본: 오늘 데이터
    if (!startDate && !endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.createdAt = { gte: today };
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
      const hour = new Date(event.createdAt).getHours();
      hourlyData[hour].count++;
    });

    return hourlyData;
  }

  // 일별 추이 (최근 7일)
  async getDailyTrend() {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.prisma.appEvent.count({
        where: {
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
