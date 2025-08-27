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
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ManagementRefundService } from '../services/management-refund.service';

@Controller('management/refund')
@UseGuards(ApiKeyGuard)
export class ManagementRefundController {
  constructor(private readonly refundService: ManagementRefundService) {}

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
}