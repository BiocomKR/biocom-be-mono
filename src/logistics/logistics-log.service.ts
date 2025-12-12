import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

interface FindAllParams {
  status?: string;
  orderId?: number;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

@Injectable()
export class LogisticsLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 물류 API 로그 목록 조회
   */
  async findAll(params: FindAllParams) {
    const { status, orderId, startDate, endDate, page, limit } = params;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (orderId) {
      where.orderId = orderId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.logisticsApiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              recipientName: true,
            },
          },
        },
      }),
      this.prisma.logisticsApiLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        orderNumber: item.order?.orderNumber,
        recipientName: item.order?.recipientName,
        endpoint: item.endpoint,
        method: item.method,
        status: item.status,
        errorMessage: item.errorMessage,
        requestData: item.requestData,
        responseData: item.responseData,
        retryCount: item.retryCount,
        createdAt: item.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
