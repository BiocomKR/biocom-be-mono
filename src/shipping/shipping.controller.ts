import {
  Controller,
  Put,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShippingService } from './shipping.service';

@Controller('management/shipping')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * 전체 배송 목록 조회
   */
  @Get()
                  async findAll(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.shippingService.findAll({
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
  }

  /**
   * 운송장 번호 등록
   * 택배사에서 발행받은 운송장 번호를 시스템에 등록
   */
  @Put(':orderNumber/tracking')
              async registerTracking(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: {
      courierCode: string;
      courierName: string;
      trackingNumber: string;
    }
  ) {
    return this.shippingService.registerTracking(orderNumber, dto);
  }

  /**
   * 배송 시작 처리
   * 택배사가 물건을 수거한 후 배송 시작 상태로 변경
   */
  @Post(':orderNumber/start')
            async startShipping(
    @Param('orderNumber') orderNumber: string
  ) {
    return this.shippingService.startShipping(orderNumber);
  }

  /**
   * 배송 완료 처리
   * 고객이 물건을 수령한 후 배송 완료 상태로 변경
   */
  @Post(':orderNumber/complete')
      async completeShipping(
    @Param('orderNumber') orderNumber: string
  ) {
    return this.shippingService.completeShipping(orderNumber);
  }

  /**
   * 배송 상태 일괄 변경
   */
  @Post('batch/status')
        async batchUpdateStatus(
    @Body() dto: {
      orderNumbers: string[];
      status: string;
    }
  ) {
    return this.shippingService.batchUpdateStatus(dto.orderNumbers, dto.status);
  }

  /**
   * 배송 통계
   */
  @Get('statistics')
        async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.shippingService.getStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }
}