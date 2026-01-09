import {
  Controller,
  Get,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('대시보드')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 대시보드 요약
   */
  @Get('summary')
  async getSummary(
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    return this.dashboardService.getSummary(exclude);
  }

  /**
   * 매출 통계
   */
  @Get('sales')
          async getSalesStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: string
  ) {
    return this.dashboardService.getSalesStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy: groupBy as 'day' | 'week' | 'month' || 'day'
    });
  }

  /**
   * 상품별 매출
   */
  @Get('sales/products')
          async getProductSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string
  ) {
    return this.dashboardService.getProductSales({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 10
    });
  }

  /**
   * 카테고리별 매출
   */
  @Get('sales/categories')
        async getCategorySales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.dashboardService.getCategorySales({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  /**
   * 주문 통계
   */
  @Get('orders')
        async getOrderStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.dashboardService.getOrderStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  /**
   * 고객 통계
   */
  @Get('customers')
  async getCustomerStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    return this.dashboardService.getCustomerStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      excludeTesters: exclude,
    });
  }

  /**
   * 재고 알림
   */
  @Get('inventory/alerts')
      async getInventoryAlerts(
    @Query('threshold') threshold?: string
  ) {
    return this.dashboardService.getInventoryAlerts(
      threshold ? parseInt(threshold) : 10
    );
  }

  /**
   * 환불 통계
   */
  @Get('refunds')
        async getRefundStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.dashboardService.getRefundStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  /**
   * 실시간 현황
   */
  @Get('realtime')
    async getRealtimeStatus() {
    return this.dashboardService.getRealtimeStatus();
  }
}