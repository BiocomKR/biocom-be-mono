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
}
