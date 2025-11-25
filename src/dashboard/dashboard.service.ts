import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 대시보드 요약
   */
  async getSummary() {
    const today = getNowKST();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // 오늘 매출
    const todaySales = await this.prisma.order.aggregate({
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: { totalAmount: true },
      _count: true
    });

    // 이번 달 매출
    const monthSales = await this.prisma.order.aggregate({
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: thisMonth,
          lt: nextMonth
        }
      },
      _sum: { totalAmount: true },
      _count: true
    });

    // 신규 회원 (오늘)
    const newUsersToday = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // 신규 회원 (이번 달)
    const newUsersMonth = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: thisMonth,
          lt: nextMonth
        }
      }
    });

    // 대기 중인 주문
    const pendingOrders = await this.prisma.order.count({
      where: {
        status: { in: ['PAID', 'PREPARING'] }
      }
    });

    // 대기 중인 환불
    const pendingRefunds = await this.prisma.refund.count({
      where: {
        status: 'PENDING'
      }
    });

    // 재고 부족 상품
    const lowStockCount = await this.prisma.inventoryCache.count({
      where: {
        availableQty: { lt: 10 }
      }
    });

    return {
      today: {
        sales: Number(todaySales._sum.totalAmount || 0),
        orders: todaySales._count,
        newUsers: newUsersToday
      },
      month: {
        sales: Number(monthSales._sum.totalAmount || 0),
        orders: monthSales._count,
        newUsers: newUsersMonth
      },
      pending: {
        orders: pendingOrders,
        refunds: pendingRefunds
      },
      alerts: {
        lowStock: lowStockCount
      }
    };
  }

  /**
   * 매출 통계
   */
  async getSalesStatistics(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy: 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, groupBy } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        paidAt: true,
        totalAmount: true,
        totalProductPrice: true,
        shippingFee: true,
        pointUsed: true
      }
    });

    // 그룹별 집계
    const grouped = new Map<string, any>();

    orders.forEach(order => {
      if (!order.paidAt) return;
      
      let key: string;
      const date = new Date(order.paidAt);
      
      switch (groupBy) {
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'day':
        default:
          key = date.toISOString().split('T')[0];
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          sales: 0,
          orders: 0,
          productSales: 0,
          shippingFees: 0,
          pointsUsed: 0
        });
      }

      const group = grouped.get(key);
      group.sales += Number(order.totalAmount);
      group.orders += 1;
      group.productSales += Number(order.totalProductPrice);
      group.shippingFees += Number(order.shippingFee);
      group.pointsUsed += Number(order.pointUsed);
    });

    return Array.from(grouped.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
  }

  /**
   * 상품별 매출
   */
  async getProductSales(params: {
    startDate?: Date;
    endDate?: Date;
    limit: number;
  }) {
    const { startDate, endDate, limit } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const productSales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
          paidAt: {
            gte: start,
            lte: end
          }
        }
      },
      _sum: {
        quantity: true,
        subtotal: true
      },
      _count: true,
      orderBy: {
        _sum: {
          subtotal: 'desc'
        }
      },
      take: limit
    });

    // 상품 정보 조회
    const productIds = productSales.map(item => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    return productSales.map(item => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        productName: (product as any)?.name || 'Unknown',
        productSku: (product as any)?.sku || '',
        categoryName: (product as any)?.category?.name || '',
        quantity: item._sum.quantity || 0,
        sales: Number(item._sum.subtotal || 0),
        orderCount: item._count
      };
    });
  }

  /**
   * 카테고리별 매출
   * ⚠️ Categories 테이블 제거로 인해 Products.categoryCode 기반으로 변경
   */
  async getCategorySales(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const categorySales = await this.prisma.$queryRaw`
      SELECT
        p.category_code as category_code,
        p.category_name as category_name,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_sales
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED')
        AND o.paid_at >= ${start}
        AND o.paid_at <= ${end}
      GROUP BY p.category_code, p.category_name
      ORDER BY total_sales DESC
    ` as any[];

    const totalSales = categorySales.reduce((sum, item) =>
      sum + Number(item.total_sales || 0), 0
    );

    return categorySales.map(item => ({
      categoryCode: item.category_code,
      categoryName: item.category_name,
      orderCount: Number(item.order_count || 0),
      quantity: Number(item.total_quantity || 0),
      sales: Number(item.total_sales || 0),
      percentage: totalSales > 0
        ? ((Number(item.total_sales || 0) / totalSales) * 100).toFixed(2)
        : '0.00'
    }));
  }

  /**
   * 주문 통계
   */
  async getOrderStatistics(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 상태별 주문 수
    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        orderedAt: {
          gte: start,
          lte: end
        }
      },
      _count: true
    });

    // 평균 주문 금액
    const avgOrderAmount = await this.prisma.order.aggregate({
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: start,
          lte: end
        }
      },
      _avg: { totalAmount: true }
    });

    // 취소율
    const totalOrders = await this.prisma.order.count({
      where: {
        orderedAt: {
          gte: start,
          lte: end
        }
      }
    });

    const cancelledOrders = await this.prisma.order.count({
      where: {
        status: 'CANCELLED',
        orderedAt: {
          gte: start,
          lte: end
        }
      }
    });

    return {
      statusDistribution: statusCounts.map(item => ({
        status: item.status,
        count: item._count
      })),
      averageOrderAmount: Number(avgOrderAmount._avg.totalAmount || 0),
      cancellationRate: totalOrders > 0 
        ? ((cancelledOrders / totalOrders) * 100).toFixed(2)
        : '0.00',
      totalOrders,
      cancelledOrders
    };
  }

  /**
   * 고객 통계
   */
  async getCustomerStatistics(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 신규 고객
    const newCustomers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    // 구매 고객
    const purchasingCustomers = await this.prisma.order.findMany({
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        userId: true
      },
      distinct: ['userId']
    });

    // 재구매 고객 (2회 이상 구매)
    const customerOrders = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: start,
          lte: end
        }
      },
      _count: true,
      having: {
        userId: {
          _count: {
            gt: 1
          }
        }
      }
    });

    // 고객별 평균 구매액
    const customerSpending = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] },
        paidAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    const avgSpending = customerSpending.length > 0
      ? customerSpending.reduce((sum, item) => 
          sum + Number(item._sum.totalAmount || 0), 0
        ) / customerSpending.length
      : 0;

    return {
      newCustomers,
      purchasingCustomers: purchasingCustomers.length,
      repeatCustomers: customerOrders.length,
      repeatRate: purchasingCustomers.length > 0
        ? ((customerOrders.length / purchasingCustomers.length) * 100).toFixed(2)
        : '0.00',
      averageCustomerSpending: avgSpending
    };
  }

  /**
   * 재고 알림
   */
  async getInventoryAlerts(threshold: number) {
    const lowStockItems = await this.prisma.inventoryCache.findMany({
      where: {
        availableQty: { lt: threshold }
      },
      orderBy: {
        availableQty: 'asc'
      }
    });

    // SKU로 Product 직접 조회
    const skus = lowStockItems.map(item => item.sku);
    const products = await this.prisma.product.findMany({
      where: { sku: { in: skus } },
      select: {
        id: true,
        name: true,
        sku: true,
        status: true
      }
    });

    const productMap = new Map(products.map(p => [p.sku, p]));

    return lowStockItems.map(item => {
      const product = productMap.get(item.sku) as { id: number; name: string; sku: string; status: string } | undefined;
      return {
        sku: item.sku,
        availableQty: item.availableQty,
        productId: product?.id ?? undefined,
        productName: product?.name ?? 'Unknown',
        productSku: product?.sku ?? undefined,
        status: product?.status ?? undefined,
        alertLevel: item.availableQty === 0 ? 'OUT_OF_STOCK' :
                    item.availableQty < 5 ? 'CRITICAL' : 'LOW'
      };
    });
  }

  /**
   * 환불 통계
   */
  async getRefundStatistics(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;

    // 기본값: 최근 30일
    const end = endDate || getNowKST();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 상태별 환불 수
    const statusCounts = await this.prisma.refund.groupBy({
      by: ['status'],
      where: {
        requestedAt: {
          gte: start,
          lte: end
        }
      },
      _count: true,
      _sum: {
        refundAmount: true
      }
    });

    // 환불 사유별 통계
    const reasonStats = await this.prisma.refund.groupBy({
      by: ['reason'],
      where: {
        requestedAt: {
          gte: start,
          lte: end
        },
        status: 'COMPLETED'
      },
      _count: true,
      _sum: {
        refundAmount: true
      }
    });

    // 평균 처리 시간 (요청 ~ 완료)
    const completedRefunds = await this.prisma.refund.findMany({
      where: {
        status: 'COMPLETED',
        requestedAt: {
          gte: start,
          lte: end
        },
        completedAt: { not: null }
      },
      select: {
        requestedAt: true,
        completedAt: true
      }
    });

    const processingTimes = completedRefunds
      .filter(r => r.completedAt)
      .map(r => {
        const requested = new Date(r.requestedAt).getTime();
        const completed = new Date(r.completedAt!).getTime();
        return (completed - requested) / (1000 * 60 * 60); // 시간 단위
      });

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      statusDistribution: statusCounts.map(item => ({
        status: item.status,
        count: item._count,
        amount: Number(item._sum.refundAmount || 0)
      })),
      reasonDistribution: reasonStats.map(item => ({
        reason: item.reason,
        count: item._count,
        amount: Number(item._sum.refundAmount || 0)
      })),
      averageProcessingHours: avgProcessingTime.toFixed(1),
      totalRefunds: statusCounts.reduce((sum, item) => sum + item._count, 0),
      totalRefundAmount: statusCounts.reduce((sum, item) => 
        sum + Number(item._sum.refundAmount || 0), 0
      )
    };
  }

  /**
   * 실시간 현황
   */
  async getRealtimeStatus() {
    const now = getNowKST();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 최근 1시간 주문
    const recentOrders = await this.prisma.order.findMany({
      where: {
        orderedAt: {
          gte: oneHourAgo
        }
      },
      orderBy: {
        orderedAt: 'desc'
      },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // 오늘 시간대별 매출
    const hourlyOrders = await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM ordered_at) as hour,
        COUNT(*) as order_count,
        SUM(total_amount) as sales
      FROM orders
      WHERE ordered_at >= ${today}
        AND status NOT IN ('PENDING_PAYMENT', 'CANCELLED')
      GROUP BY EXTRACT(HOUR FROM ordered_at)
      ORDER BY hour
    ` as any[];

    // 현재 활성 사용자 (lastLoginAt 필드가 없으므로 0으로 설정)
    const activeUsers = 0; // TODO: lastLoginAt 필드 추가 필요

    return {
      currentTime: now,
      activeUsers,
      recentOrders: recentOrders.map(order => ({
        orderNumber: order.orderNumber,
        customerName: order.user.name,
        amount: Number(order.totalAmount),
        status: order.status,
        orderedAt: order.orderedAt
      })),
      hourlyData: hourlyOrders.map(item => ({
        hour: Number(item.hour),
        orders: Number(item.order_count),
        sales: Number(item.sales || 0)
      }))
    };
  }
}