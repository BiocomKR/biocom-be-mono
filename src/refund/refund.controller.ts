import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefundService } from './refund.service';

@ApiTags('환불 관리')
@ApiBearerAuth()
@Controller('refund')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * 전체 환불 목록 조회
   */
  @Get()
              async findAll(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.refundService.findAll({
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20
    });
  }

  /**
   * 환불 상세 조회
   */
  @Get(':id')
      async findOne(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.refundService.findOne(id);
  }

  /**
   * 환불 승인
   * 환불 요청을 검토하고 승인 처리
   */
  @Post(':id/approve')
        async approveRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.approveRefund(id, adminMemo);
  }

  /**
   * 환불 거절
   * 환불 요청을 검토하고 거절 처리
   */
  @Post(':id/reject')
        async rejectRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.rejectRefund(id, reason, adminMemo);
  }

  /**
   * 환불 완료 처리
   * 실제 환불이 완료된 후 시스템에 반영
   */
  @Post(':id/complete')
        async completeRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body('transactionId') transactionId: string,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.completeRefund(id, transactionId, adminMemo);
  }

  /**
   * 환불 상태 일괄 변경
   */
  @Post('batch/status')
      async batchUpdate(
    @Body() dto: {
      refundIds: number[];
      action: 'approve' | 'reject';
      reason?: string;
    }
  ) {
    return this.refundService.batchUpdate(dto);
  }

  /**
   * 환불 통계
   */
  @Get('statistics/summary')
        async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.refundService.getStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  /**
   * 대기 중인 환불 목록
   */
  @Get('pending/list')
    async getPendingRefunds() {
    return this.refundService.getPendingRefunds();
  }

  /**
   * 반품/교환 승인
   */
  @Post('return/:orderNumber/:returnId/approve')
  async approveReturn(
    @Param('orderNumber') orderNumber: string,
    @Param('returnId', ParseIntPipe) returnId: number
  ) {
    return this.refundService.approveReturn(orderNumber, returnId);
  }

  /**
   * 반품 완료 및 환불 처리
   */
  @Post('return/:orderNumber/:returnId/complete')
  async completeReturn(
    @Param('orderNumber') orderNumber: string,
    @Param('returnId', ParseIntPipe) returnId: number,
    @Body('returnTrackingNumber') returnTrackingNumber?: string
  ) {
    return this.refundService.completeReturn(orderNumber, returnId, returnTrackingNumber);
  }

  /**
   * 교환 승인
   */
  @Post('exchange/:orderNumber/:exchangeId/approve')
  async approveExchange(
    @Param('orderNumber') orderNumber: string,
    @Param('exchangeId', ParseIntPipe) exchangeId: number
  ) {
    return this.refundService.approveExchange(orderNumber, exchangeId);
  }

  /**
   * 교환 완료 처리
   */
  @Post('exchange/:orderNumber/:exchangeId/complete')
  async completeExchange(
    @Param('orderNumber') orderNumber: string,
    @Param('exchangeId', ParseIntPipe) exchangeId: number,
    @Body('exchangeTrackingNumber') exchangeTrackingNumber?: string
  ) {
    return this.refundService.completeExchange(orderNumber, exchangeId, exchangeTrackingNumber);
  }

  /**
   * 관리자 주문 취소 (고객 대신 취소)
   * Refund 레코드 생성 및 즉시 취소 처리
   */
  @Post('admin-cancel/:orderId')
  async adminCancelOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body('reason') reason: string,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.adminCancelOrder(orderId, reason, adminMemo);
  }
}